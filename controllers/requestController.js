'use strict';

/**
 * controllers/requestController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles donation requests from receivers and donor responses.
 *
 * Exports:
 *   createRequest(req, res, next)    – POST  /api/v1/requests/create     [Receiver]
 *   respondToRequest(req, res, next) – PATCH /api/v1/requests/:id/respond [Donor]
 *   getMyRequests(req, res, next)    – GET   /api/v1/requests/mine        [Any auth]
 *   getRequestById(req, res, next)   – GET   /api/v1/requests/:id         [Donor|Receiver|Volunteer|Admin]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }          = require('../config/db');
const { dbQueryLogger } = require('../middleware/logger');

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/requests/create   [Receiver only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A receiver submits a request for a specific food listing.
 *
 * Business rules enforced:
 *  1. The food item must exist.
 *  2. The food item must be status = 'available'.
 *  3. The receiver cannot request their own donation.
 *  4. A receiver cannot have two PENDING requests for the same food item.
 *
 * Body: { food_id, pickup_note? }
 */
async function createRequest(req, res, next) {
  try {
    const { food_id, pickup_note = null } = req.body;
    const receiver_id = req.user.sub;

    // ── 1. Validate input ────────────────────────────────────────────────
    if (!food_id || !Number.isInteger(Number(food_id)) || Number(food_id) < 1) {
      return res.status(400).json({ success: false, error: 'food_id must be a positive integer' });
    }

    // ── 2. Fetch the food item ───────────────────────────────────────────
    const foodSQL = 'SELECT food_id, donor_id, food_name, status FROM `FOOD_ITEM` WHERE food_id = ? LIMIT 1';
    dbQueryLogger(foodSQL, [food_id]);
    const [[food]] = await pool.execute(foodSQL, [Number(food_id)]);

    if (!food) {
      return res.status(404).json({ success: false, error: 'Food listing not found' });
    }

    // ── 3. Business rule: food must be available ─────────────────────────
    if (food.status !== 'available') {
      return res.status(409).json({
        success: false,
        error:   'Food not available',
        message: `This listing is currently '${food.status}' and cannot be requested.`,
      });
    }

    // ── 4. Business rule: receiver cannot request their own food ─────────
    if (food.donor_id === receiver_id) {
      return res.status(400).json({
        success: false,
        error:   'You cannot request your own food listing.',
      });
    }

    // ── 5. Duplicate pending request check ───────────────────────────────
    const dupSQL = `
      SELECT request_id FROM \`DONATION_REQUEST\`
      WHERE food_id = ? AND receiver_id = ? AND status = 'pending'
      LIMIT 1
    `;
    dbQueryLogger(dupSQL, [food_id, receiver_id]);
    const [[dup]] = await pool.execute(dupSQL, [Number(food_id), receiver_id]);

    if (dup) {
      return res.status(409).json({
        success: false,
        error:   'Duplicate request',
        message: 'You already have a pending request for this food listing.',
      });
    }

    // ── 6. Insert the donation request ───────────────────────────────────
    const insertSQL = `
      INSERT INTO \`DONATION_REQUEST\` (food_id, receiver_id, status, pickup_note)
      VALUES (?, ?, 'pending', ?)
    `;
    dbQueryLogger(insertSQL, [food_id, receiver_id, pickup_note]);
    const [result] = await pool.execute(insertSQL, [Number(food_id), receiver_id, pickup_note]);

    // ── 7. Return the new request ────────────────────────────────────────
    const fetchSQL = `
      SELECT
        dr.*,
        f.food_name,
        f.food_type,
        f.quantity,
        u_donor.name     AS donor_name,
        u_receiver.name  AS receiver_name
      FROM \`DONATION_REQUEST\` dr
      JOIN \`FOOD_ITEM\`  f          ON f.food_id      = dr.food_id
      JOIN \`USER\`       u_donor    ON u_donor.user_id = f.donor_id
      JOIN \`USER\`       u_receiver ON u_receiver.user_id = dr.receiver_id
      WHERE dr.request_id = ?
    `;
    dbQueryLogger(fetchSQL, [result.insertId]);
    const [[newRequest]] = await pool.execute(fetchSQL, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Donation request submitted successfully',
      data:    newRequest,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v1/requests/:id/respond   [Donor only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A donor accepts or rejects a pending donation request.
 *
 * On ACCEPT (transaction):
 *   1. DONATION_REQUEST.status  → 'accepted'
 *   2. FOOD_ITEM.status         → 'reserved'
 *   3. INSERT into DELIVERY     (volunteer_id from body or null-assigned)
 *
 * On REJECT:
 *   1. DONATION_REQUEST.status  → 'rejected'
 *
 * Body: { action: 'accept' | 'reject', volunteer_id? }
 */
async function respondToRequest(req, res, next) {
  const conn = await pool.getConnection();

  try {
    const request_id  = parseInt(req.params.id, 10);
    const { action, volunteer_id = null } = req.body;
    const donor_id    = req.user.sub;

    // ── 1. Validate ──────────────────────────────────────────────────────
    if (isNaN(request_id) || request_id < 1) {
      conn.release();
      return res.status(400).json({ success: false, error: 'request_id must be a positive integer' });
    }
    if (!['accept', 'reject'].includes(action)) {
      conn.release();
      return res.status(400).json({ success: false, error: "action must be 'accept' or 'reject'" });
    }

    // ── 2. Fetch request + food to verify ownership ──────────────────────
    const reqSQL = `
      SELECT dr.request_id, dr.status AS req_status, dr.food_id, dr.receiver_id,
             f.donor_id, f.status AS food_status, f.food_name
      FROM \`DONATION_REQUEST\` dr
      JOIN \`FOOD_ITEM\` f ON f.food_id = dr.food_id
      WHERE dr.request_id = ?
    `;
    dbQueryLogger(reqSQL, [request_id]);
    const [[reqRow]] = await conn.execute(reqSQL, [request_id]);

    if (!reqRow) {
      conn.release();
      return res.status(404).json({ success: false, error: 'Donation request not found' });
    }

    // ── 3. Authorization: only the food's donor may respond ──────────────
    if (reqRow.donor_id !== donor_id) {
      conn.release();
      return res.status(403).json({
        success: false,
        error:   'Forbidden',
        message: 'Only the donor of this food listing can respond to requests.',
      });
    }

    // ── 4. State guard: can only respond to pending requests ─────────────
    if (reqRow.req_status !== 'pending') {
      conn.release();
      return res.status(409).json({
        success: false,
        error:   'Request already actioned',
        message: `This request is already '${reqRow.req_status}'.`,
      });
    }

    // ── 5. REJECT path (simple update, no transaction needed) ────────────
    if (action === 'reject') {
      const rejectSQL = "UPDATE `DONATION_REQUEST` SET status = 'rejected' WHERE request_id = ?";
      dbQueryLogger(rejectSQL, [request_id]);
      await conn.execute(rejectSQL, [request_id]);
      conn.release();

      return res.status(200).json({
        success: true,
        message: 'Donation request rejected',
        data:    { request_id, status: 'rejected' },
      });
    }

    // ── 6. ACCEPT path — transaction ─────────────────────────────────────
    await conn.beginTransaction();

    //  6a. Update DONATION_REQUEST → 'accepted'
    const acceptReqSQL = "UPDATE `DONATION_REQUEST` SET status = 'accepted' WHERE request_id = ?";
    dbQueryLogger(acceptReqSQL, [request_id]);
    await conn.execute(acceptReqSQL, [request_id]);

    //  6b. Update FOOD_ITEM → 'reserved'
    const reserveFoodSQL = "UPDATE `FOOD_ITEM` SET status = 'reserved' WHERE food_id = ?";
    dbQueryLogger(reserveFoodSQL, [reqRow.food_id]);
    await conn.execute(reserveFoodSQL, [reqRow.food_id]);

    //  6c. Create DELIVERY record
    //      volunteer_id may be null here if assignment happens later
    const deliverySQL = `
      INSERT INTO \`DELIVERY\` (request_id, volunteer_id, status)
      VALUES (?, ?, 'assigned')
    `;
    dbQueryLogger(deliverySQL, [request_id, volunteer_id]);
    const [delivResult] = await conn.execute(deliverySQL, [request_id, volunteer_id]);

    await conn.commit();

    return res.status(200).json({
      success:  true,
      message:  'Donation request accepted and delivery created',
      data: {
        request_id,
        request_status: 'accepted',
        food_status:    'reserved',
        delivery_id:    delivResult.insertId,
        volunteer_id,
      },
    });

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/requests/mine   [Any authenticated user]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns requests associated with the calling user:
 *   - Receiver → their outgoing requests
 *   - Donor    → requests against their food listings
 *   - Volunteer / Admin → all (paginated)
 *
 * Query: ?status=pending|accepted|rejected|completed|cancelled  &  page  &  limit
 */
async function getMyRequests(req, res, next) {
  try {
    const { role, sub: user_id } = req.user;
    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const VALID_STATUSES = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    let roleFilter = '';
    let params     = [];

    if (role === 'receiver') {
      roleFilter = 'dr.receiver_id = ?';
      params.push(user_id);
    } else if (role === 'donor') {
      roleFilter = 'f.donor_id = ?';
      params.push(user_id);
    }
    // volunteer/admin: no role filter → see all

    const whereClauses = roleFilter ? [roleFilter] : [];
    if (status) { whereClauses.push('dr.status = ?'); params.push(status); }
    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSQL = `
      SELECT COUNT(*) AS total FROM \`DONATION_REQUEST\` dr
      JOIN \`FOOD_ITEM\` f ON f.food_id = dr.food_id
      ${whereSQL}
    `;
    dbQueryLogger(countSQL, params);
    const [[{ total }]] = await pool.query(countSQL, params);

    const dataSQL = `
      SELECT
        dr.request_id, dr.status, dr.pickup_note, dr.requested_at,
        f.food_id, f.food_name, f.food_type, f.quantity, f.expiry_time,
        u_donor.user_id    AS donor_id,    u_donor.name    AS donor_name,
        u_receiver.user_id AS receiver_id, u_receiver.name AS receiver_name,
        d.delivery_id, d.status AS delivery_status
      FROM \`DONATION_REQUEST\` dr
      JOIN \`FOOD_ITEM\`  f          ON f.food_id        = dr.food_id
      JOIN \`USER\`       u_donor    ON u_donor.user_id  = f.donor_id
      JOIN \`USER\`       u_receiver ON u_receiver.user_id = dr.receiver_id
      LEFT JOIN \`DELIVERY\` d       ON d.request_id     = dr.request_id
      ${whereSQL}
      ORDER BY dr.requested_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    dbQueryLogger(dataSQL, dataParams);
    const [rows] = await pool.query(dataSQL, dataParams);

    return res.status(200).json({
      success: true,
      pagination: {
        total: Number(total), page, limit,
        totalPages:  Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
      data: rows,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/requests/:id   [Donor | Receiver | Volunteer | Admin]
// ─────────────────────────────────────────────────────────────────────────────
async function getRequestById(req, res, next) {
  try {
    const request_id = parseInt(req.params.id, 10);
    if (isNaN(request_id) || request_id < 1) {
      return res.status(400).json({ success: false, error: 'request_id must be a positive integer' });
    }

    const sql = `
      SELECT
        dr.*,
        f.food_name, f.food_type, f.quantity, f.expiry_time, f.description,
        u_donor.user_id    AS donor_id,    u_donor.name    AS donor_name,    u_donor.location AS donor_location,
        u_receiver.user_id AS receiver_id, u_receiver.name AS receiver_name,
        d.delivery_id, d.status AS delivery_status, d.pickup_time, d.delivered_time,
        u_vol.name AS volunteer_name
      FROM \`DONATION_REQUEST\` dr
      JOIN \`FOOD_ITEM\`  f          ON f.food_id         = dr.food_id
      JOIN \`USER\`       u_donor    ON u_donor.user_id   = f.donor_id
      JOIN \`USER\`       u_receiver ON u_receiver.user_id = dr.receiver_id
      LEFT JOIN \`DELIVERY\` d       ON d.request_id      = dr.request_id
      LEFT JOIN \`USER\`  u_vol      ON u_vol.user_id     = d.volunteer_id
      WHERE dr.request_id = ?
    `;
    dbQueryLogger(sql, [request_id]);
    const [[row]] = await pool.execute(sql, [request_id]);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Donation request not found' });
    }

    return res.status(200).json({ success: true, data: row });

  } catch (err) {
    next(err);
  }
}

module.exports = { createRequest, respondToRequest, getMyRequests, getRequestById };
