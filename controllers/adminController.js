'use strict';

/**
 * controllers/adminController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-only operations. All routes must be guarded by verifyRole('admin').
 *
 * Endpoints:
 *  GET   /admin/stats             – platform overview numbers
 *  GET   /admin/users             – paginated user list with filters
 *  PATCH /admin/users/:id/status  – activate | ban | verify a user
 *  GET   /admin/food              – all food items (inc. checklist flags)
 *  PATCH /admin/food/:id/flag     – flag / unflag a listing
 *  PATCH /admin/food/:id/expire   – manually expire a listing
 *  GET   /admin/deliveries        – all deliveries with volunteer assignment info
 *  PATCH /admin/deliveries/:id/assign – assign a volunteer to a delivery
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }     = require('../config/db');
const { dbQueryLogger: logQuery } = require('../middleware/logger');

const ok  = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const err = (res, msg, status = 400)  => res.status(status).json({ success: false, message: msg });

/* ── pagination helper ─────────────────────────────────────────────────────── */
function paginate(query, limit) {
  const p = Math.max(1, parseInt(query.page)  || 1);
  const l = Math.min(100, Math.max(1, parseInt(query.limit) || limit));
  return { page: p, limit: l, offset: (p - 1) * l };
}

/* ══════════════════════════════════════════════════════════════════════════════
   GET /admin/stats
   Returns platform-wide aggregated counts for the admin overview cards.
══════════════════════════════════════════════════════════════════════════════ */
async function getPlatformStats(req, res, next) {
  try {
    const [[users]] = await pool.query(`
      SELECT
        COUNT(*)                                   AS total_users,
        SUM(role = 'donor')                        AS donors,
        SUM(role = 'receiver')                     AS receivers,
        SUM(role = 'volunteer')                    AS volunteers,
        SUM(is_verified = 1)                       AS verified_users,
        SUM(is_verified = 0 AND status = 'active') AS pending_users,
        SUM(status = 'banned')                     AS banned_users
      FROM USER`);

    const [[food]] = await pool.query(`
      SELECT
        COUNT(*)                      AS total_listings,
        SUM(status = 'available')     AS available_listings,
        SUM(status = 'reserved')      AS reserved_listings,
        SUM(status = 'donated')       AS donated_listings,
        SUM(status = 'expired')       AS expired_listings,
        SUM(is_flagged = 1)           AS flagged_listings
      FROM FOOD_ITEM`);

    const [[deliveries]] = await pool.query(`
      SELECT
        COUNT(*)                      AS total_deliveries,
        SUM(status = 'assigned')      AS assigned_deliveries,
        SUM(status = 'picked_up')     AS pickedup_deliveries,
        SUM(status = 'delivered')     AS delivered_deliveries,
        SUM(status = 'failed')        AS failed_deliveries
      FROM DELIVERY`);

    logQuery('ADMIN stats', []);

    return ok(res, { data: { users, food, deliveries } });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   GET /admin/users
   Filters: role, status, is_verified, search (name/email)
══════════════════════════════════════════════════════════════════════════════ */
async function getAllUsers(req, res, next) {
  try {
    const { page, limit, offset } = paginate(req.query, 20);
    const { role, status, is_verified, search } = req.query;

    const conditions = [];
    const params     = [];

    if (role)        { conditions.push('role = ?');        params.push(role); }
    if (status)      { conditions.push('status = ?');      params.push(status); }
    if (is_verified != null && is_verified !== '') {
      conditions.push('is_verified = ?');
      params.push(Number(is_verified));
    }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM USER ${WHERE}`, params,
    );

    const [rows] = await pool.query(
      `SELECT user_id, name, email, phone, role, location, status, is_verified, created_at
       FROM   USER ${WHERE}
       ORDER  BY created_at DESC
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset],
    );

    logQuery('ADMIN getAllUsers', params);

    return ok(res, {
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /admin/users/:id/status
   Body: { status: 'active'|'banned'|'suspended', is_verified: 0|1 }
══════════════════════════════════════════════════════════════════════════════ */
async function updateUserStatus(req, res, next) {
  try {
    const userId = parseInt(req.params.id);
    const { status, is_verified } = req.body;

    const VALID_STATUSES = ['active', 'banned', 'suspended'];
    if (status && !VALID_STATUSES.includes(status))
      return err(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);

    // Prevent admin from banning themselves
    if (req.user.sub === userId && status === 'banned')
      return err(res, 'You cannot ban your own account', 403);

    const fields  = [];
    const params  = [];

    if (status      != null) { fields.push('status = ?');      params.push(status); }
    if (is_verified != null) { fields.push('is_verified = ?'); params.push(Number(is_verified)); }

    if (!fields.length) return err(res, 'No update fields provided');

    params.push(userId);
    const [result] = await pool.query(
      `UPDATE USER SET ${fields.join(', ')} WHERE user_id = ?`, params,
    );
    logQuery('ADMIN updateUserStatus', params);

    if (result.affectedRows === 0) return err(res, 'User not found', 404);

    return ok(res, { message: 'User updated successfully' });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   GET /admin/food
   Returns all food items joined with checklist and donor name.
   Filters: status, is_flagged, food_type, search
══════════════════════════════════════════════════════════════════════════════ */
async function getAllFoodItems(req, res, next) {
  try {
    const { page, limit, offset } = paginate(req.query, 25);
    const { status, is_flagged, food_type, search } = req.query;

    const conditions = [];
    const params     = [];

    if (status)    { conditions.push('f.status = ?');      params.push(status); }
    if (food_type) { conditions.push('f.food_type = ?');   params.push(food_type); }
    if (is_flagged != null && is_flagged !== '') {
      conditions.push('f.is_flagged = ?');
      params.push(Number(is_flagged));
    }
    if (search) {
      conditions.push('(f.food_name LIKE ? OR u.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM   FOOD_ITEM f
       JOIN   USER u ON f.donor_id = u.user_id
       ${WHERE}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT
         f.food_id, f.food_name, f.description, f.quantity, f.food_type,
         f.status, f.is_flagged, f.expiry_time, f.created_at,
         u.user_id AS donor_id, u.name AS donor_name, u.email AS donor_email,
         c.is_freshly_cooked, c.proper_packaging, c.hygiene_maintained, c.allergen_declared
       FROM   FOOD_ITEM f
       JOIN   USER u ON f.donor_id = u.user_id
       LEFT   JOIN FOOD_SAFETY_CHECKLIST c ON f.food_id = c.food_id
       ${WHERE}
       ORDER  BY f.created_at DESC
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset],
    );

    logQuery('ADMIN getAllFoodItems', params);

    return ok(res, {
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /admin/food/:id/flag
   Body: { is_flagged: 0|1, flag_reason?: string }
══════════════════════════════════════════════════════════════════════════════ */
async function flagFoodItem(req, res, next) {
  try {
    const foodId    = parseInt(req.params.id);
    const { is_flagged, flag_reason } = req.body;

    if (is_flagged == null) return err(res, 'is_flagged (0 or 1) is required');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        'UPDATE FOOD_ITEM SET is_flagged = ?, flag_reason = ? WHERE food_id = ?',
        [Number(is_flagged), flag_reason ?? null, foodId],
      );

      // Notify the donor if flagging (not unflagging)
      if (Number(is_flagged) === 1) {
        const [[food]] = await conn.query(
          'SELECT donor_id, food_name FROM FOOD_ITEM WHERE food_id = ?', [foodId],
        );
        if (food) {
          await conn.query(
            `INSERT INTO NOTIFICATION (user_id, title, message, type)
             VALUES (?, ?, ?, 'food_flagged')`,
            [
              food.donor_id,
              'Your listing has been flagged',
              `Your listing "${food.food_name}" was flagged by an admin.${flag_reason ? ' Reason: ' + flag_reason : ''}`,
            ],
          );
        }
      }

      await conn.commit();
      logQuery('ADMIN flagFoodItem', [foodId, is_flagged]);
      return ok(res, { message: `Listing ${Number(is_flagged) ? 'flagged' : 'unflagged'} successfully` });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /admin/food/:id/expire
   Manually expire a food item immediately and notify the donor.
══════════════════════════════════════════════════════════════════════════════ */
async function manuallyExpireFood(req, res, next) {
  try {
    const foodId = parseInt(req.params.id);
    const conn   = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[food]] = await conn.query(
        'SELECT donor_id, food_name, status FROM FOOD_ITEM WHERE food_id = ?', [foodId],
      );
      if (!food) { await conn.rollback(); return err(res, 'Food item not found', 404); }
      if (food.status === 'expired') { await conn.rollback(); return err(res, 'Already expired'); }

      await conn.query(
        `UPDATE FOOD_ITEM SET status = 'expired', expiry_time = NOW() WHERE food_id = ?`,
        [foodId],
      );

      await conn.query(
        `INSERT INTO NOTIFICATION (user_id, title, message, type)
         VALUES (?, 'Listing expired by admin', ?, 'food_expired')`,
        [food.donor_id, `Your listing "${food.food_name}" was manually expired by an admin.`],
      );

      await conn.commit();
      logQuery('ADMIN manuallyExpireFood', [foodId]);
      return ok(res, { message: 'Food item expired successfully' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   GET /admin/deliveries
   All deliveries with volunteer + food + donor/receiver details.
══════════════════════════════════════════════════════════════════════════════ */
async function getAllDeliveries(req, res, next) {
  try {
    const { page, limit, offset } = paginate(req.query, 20);
    const { status } = req.query;

    const conditions = [];
    const params     = [];
    if (status) { conditions.push('d.status = ?'); params.push(status); }
    const WHERE = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM DELIVERY d ${WHERE}`, params,
    );

    const [rows] = await pool.query(
      `SELECT
         d.delivery_id, d.status, d.pickup_time, d.delivered_time, d.created_at,
         v.user_id AS volunteer_id, v.name AS volunteer_name,
         f.food_id, f.food_name, f.quantity,
         don.name AS donor_name,
         rec.name AS receiver_name
       FROM   DELIVERY d
       LEFT   JOIN USER v  ON d.volunteer_id = v.user_id
       JOIN   DONATION_REQUEST dr ON d.request_id = dr.request_id
       JOIN   FOOD_ITEM f  ON dr.food_id = f.food_id
       JOIN   USER don ON f.donor_id = don.user_id
       JOIN   USER rec ON dr.receiver_id = rec.user_id
       ${WHERE}
       ORDER  BY d.created_at DESC
       LIMIT  ? OFFSET ?`,
      [...params, limit, offset],
    );

    logQuery('ADMIN getAllDeliveries', params);

    return ok(res, {
      data: rows,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /admin/deliveries/:id/assign
   Body: { volunteer_id }
══════════════════════════════════════════════════════════════════════════════ */
async function assignVolunteer(req, res, next) {
  try {
    const deliveryId  = parseInt(req.params.id);
    const { volunteer_id } = req.body;
    if (!volunteer_id) return err(res, 'volunteer_id is required');

    // Confirm the user exists and is actually a volunteer
    const [[volunteer]] = await pool.query(
      `SELECT user_id, name FROM USER WHERE user_id = ? AND role = 'volunteer' AND status = 'active'`,
      [volunteer_id],
    );
    if (!volunteer) return err(res, 'Volunteer not found or not active', 404);

    const [result] = await pool.query(
      `UPDATE DELIVERY SET volunteer_id = ?, status = 'assigned' WHERE delivery_id = ?`,
      [volunteer_id, deliveryId],
    );
    logQuery('ADMIN assignVolunteer', [volunteer_id, deliveryId]);

    if (result.affectedRows === 0) return err(res, 'Delivery not found', 404);

    // Notify the volunteer
    await pool.query(
      `INSERT INTO NOTIFICATION (user_id, title, message, type)
       VALUES (?, 'New delivery assigned', ?, 'delivery_update')`,
      [volunteer_id, `You have been assigned a new food delivery (ID #${deliveryId}). Please check your tasks.`],
    );

    return ok(res, { message: `Delivery #${deliveryId} assigned to ${volunteer.name}` });
  } catch (e) { next(e); }
}

module.exports = {
  getPlatformStats,
  getAllUsers,
  updateUserStatus,
  getAllFoodItems,
  flagFoodItem,
  manuallyExpireFood,
  getAllDeliveries,
  assignVolunteer,
};
