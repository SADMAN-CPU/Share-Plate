'use strict';

/**
 * controllers/deliveryController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages delivery logistics for accepted donation requests.
 *
 * Exports:
 *   updateDeliveryStatus(req, res, next) – PUT   /api/v1/deliveries/update-status  [Volunteer]
 *   assignVolunteer(req, res, next)      – PATCH /api/v1/deliveries/:id/assign      [Admin]
 *   getMyDeliveries(req, res, next)      – GET   /api/v1/deliveries/mine            [Volunteer]
 *   getDeliveryById(req, res, next)      – GET   /api/v1/deliveries/:id             [Auth]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }          = require('../config/db');
const { dbQueryLogger } = require('../middleware/logger');

// ─────────────────────────────────────────────────────────────────────────────
//  Delivery state-machine
//  Valid transitions: assigned → picked_up → delivered
//                     assigned | picked_up → failed
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  assigned:  ['picked_up', 'failed'],
  picked_up: ['delivered', 'failed'],
  delivered: [],   // terminal state
  failed:    [],   // terminal state
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/v1/deliveries/update-status   [Volunteer only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Volunteer updates the delivery status.
 *
 * Business rules:
 *  1. The delivery must exist.
 *  2. The caller must be the assigned volunteer (or an admin).
 *  3. The new status must be a valid next state in the machine.
 *  4. When status → 'delivered':
 *       • DELIVERY.delivered_time = NOW()
 *       • DONATION_REQUEST.status → 'completed'
 *       • FOOD_ITEM.status        → 'donated'
 *  5. When status → 'picked_up':
 *       • DELIVERY.pickup_time = NOW()
 *
 * Body: { delivery_id, status: 'picked_up' | 'delivered' | 'failed' }
 */
async function updateDeliveryStatus(req, res, next) {
  const conn = await pool.getConnection();

  try {
    const { delivery_id, status: newStatus } = req.body;
    const caller_id = req.user.sub;
    const caller_role = req.user.role;

    // ── 1. Validate ──────────────────────────────────────────────────────
    if (!delivery_id || !Number.isInteger(Number(delivery_id)) || Number(delivery_id) < 1) {
      conn.release();
      return res.status(400).json({ success: false, error: 'delivery_id must be a positive integer' });
    }

    const allStatuses = Object.keys(VALID_TRANSITIONS);
    if (!newStatus || !allStatuses.includes(newStatus) || newStatus === 'assigned') {
      conn.release();
      return res.status(400).json({
        success: false,
        error:   `status must be one of: picked_up, delivered, failed`,
      });
    }

    // ── 2. Fetch delivery + related data ─────────────────────────────────
    const fetchSQL = `
      SELECT
        d.delivery_id, d.status AS current_status, d.volunteer_id,
        d.request_id,
        dr.food_id, dr.receiver_id, dr.status AS req_status
      FROM \`DELIVERY\` d
      JOIN \`DONATION_REQUEST\` dr ON dr.request_id = d.request_id
      WHERE d.delivery_id = ?
    `;
    dbQueryLogger(fetchSQL, [delivery_id]);
    const [[delivery]] = await conn.execute(fetchSQL, [Number(delivery_id)]);

    if (!delivery) {
      conn.release();
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }

    // ── 3. Authorization: must be the assigned volunteer or admin ─────────
    if (caller_role !== 'admin' && delivery.volunteer_id !== caller_id) {
      conn.release();
      return res.status(403).json({
        success:  false,
        error:    'Forbidden',
        message:  'You are not the assigned volunteer for this delivery.',
      });
    }

    // ── 4. State-machine guard ────────────────────────────────────────────
    const allowed = VALID_TRANSITIONS[delivery.current_status] || [];
    if (!allowed.includes(newStatus)) {
      conn.release();
      return res.status(409).json({
        success: false,
        error:   'Invalid status transition',
        message: `Cannot move from '${delivery.current_status}' to '${newStatus}'. Allowed: [${allowed.join(', ') || 'none'}]`,
      });
    }

    // ── 5. Build UPDATE fields based on new status ────────────────────────
    await conn.beginTransaction();

    let deliveryUpdateSQL;
    let deliveryParams;

    if (newStatus === 'picked_up') {
      deliveryUpdateSQL = `
        UPDATE \`DELIVERY\` SET status = 'picked_up', pickup_time = NOW()
        WHERE delivery_id = ?
      `;
      deliveryParams = [Number(delivery_id)];

    } else if (newStatus === 'delivered') {
      deliveryUpdateSQL = `
        UPDATE \`DELIVERY\` SET status = 'delivered', delivered_time = NOW()
        WHERE delivery_id = ?
      `;
      deliveryParams = [Number(delivery_id)];

    } else {
      // failed
      deliveryUpdateSQL = `UPDATE \`DELIVERY\` SET status = 'failed' WHERE delivery_id = ?`;
      deliveryParams    = [Number(delivery_id)];
    }

    dbQueryLogger(deliveryUpdateSQL, deliveryParams);
    await conn.execute(deliveryUpdateSQL, deliveryParams);

    // ── 6. Cascade on 'delivered' ─────────────────────────────────────────
    if (newStatus === 'delivered') {
      const completeReqSQL = "UPDATE `DONATION_REQUEST` SET status = 'completed' WHERE request_id = ?";
      dbQueryLogger(completeReqSQL, [delivery.request_id]);
      await conn.execute(completeReqSQL, [delivery.request_id]);

      const donateFoodSQL = "UPDATE `FOOD_ITEM` SET status = 'donated' WHERE food_id = ?";
      dbQueryLogger(donateFoodSQL, [delivery.food_id]);
      await conn.execute(donateFoodSQL, [delivery.food_id]);
    }

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: `Delivery status updated to '${newStatus}'`,
      data: {
        delivery_id:    Number(delivery_id),
        status:         newStatus,
        request_id:     delivery.request_id,
        ...(newStatus === 'delivered' && {
          request_status: 'completed',
          food_status:    'donated',
        }),
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
//  PATCH /api/v1/deliveries/:id/assign   [Admin only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Assigns or re-assigns a volunteer to a delivery.
 * Only valid while the delivery is still in 'assigned' status
 * (i.e. not yet picked up).
 *
 * Body: { volunteer_id }
 */
async function assignVolunteer(req, res, next) {
  try {
    const delivery_id  = parseInt(req.params.id, 10);
    const { volunteer_id } = req.body;

    if (isNaN(delivery_id) || delivery_id < 1)
      return res.status(400).json({ success: false, error: 'delivery_id must be a positive integer' });

    if (!volunteer_id || !Number.isInteger(Number(volunteer_id)) || Number(volunteer_id) < 1)
      return res.status(400).json({ success: false, error: 'volunteer_id must be a positive integer' });

    // Verify delivery exists and is still assignable
    const checkSQL = "SELECT delivery_id, status FROM `DELIVERY` WHERE delivery_id = ?";
    dbQueryLogger(checkSQL, [delivery_id]);
    const [[deliv]] = await pool.execute(checkSQL, [delivery_id]);

    if (!deliv)
      return res.status(404).json({ success: false, error: 'Delivery not found' });

    if (deliv.status !== 'assigned') {
      return res.status(409).json({
        success: false,
        error:   'Cannot reassign',
        message: `Delivery is already in '${deliv.status}' status.`,
      });
    }

    // Verify the target user exists and is a volunteer
    const volSQL = "SELECT user_id, role FROM `USER` WHERE user_id = ? AND status = 'active'";
    dbQueryLogger(volSQL, [volunteer_id]);
    const [[vol]] = await pool.execute(volSQL, [Number(volunteer_id)]);

    if (!vol)
      return res.status(404).json({ success: false, error: 'Volunteer user not found or inactive' });

    if (vol.role !== 'volunteer')
      return res.status(400).json({ success: false, error: 'User is not a volunteer' });

    const updateSQL = "UPDATE `DELIVERY` SET volunteer_id = ? WHERE delivery_id = ?";
    dbQueryLogger(updateSQL, [volunteer_id, delivery_id]);
    await pool.execute(updateSQL, [Number(volunteer_id), delivery_id]);

    return res.status(200).json({
      success: true,
      message: 'Volunteer assigned to delivery',
      data:    { delivery_id, volunteer_id: Number(volunteer_id) },
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/deliveries/mine   [Volunteer]
// ─────────────────────────────────────────────────────────────────────────────
async function getMyDeliveries(req, res, next) {
  try {
    const volunteer_id = req.user.sub;
    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const whereClauses = ['d.volunteer_id = ?'];
    const params       = [volunteer_id];

    if (status) { whereClauses.push('d.status = ?'); params.push(status); }
    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    const countSQL = `SELECT COUNT(*) AS total FROM \`DELIVERY\` d ${whereSQL}`;
    dbQueryLogger(countSQL, params);
    const [[{ total }]] = await pool.query(countSQL, params);

    const dataSQL = `
      SELECT
        d.delivery_id, d.status, d.pickup_time, d.delivered_time, d.created_at,
        dr.request_id, dr.pickup_note,
        f.food_name, f.food_type, f.quantity,
        u_donor.name     AS donor_name,    u_donor.location  AS donor_location,
        u_receiver.name  AS receiver_name
      FROM \`DELIVERY\` d
      JOIN \`DONATION_REQUEST\` dr  ON dr.request_id   = d.request_id
      JOIN \`FOOD_ITEM\`        f   ON f.food_id        = dr.food_id
      JOIN \`USER\`  u_donor        ON u_donor.user_id  = f.donor_id
      JOIN \`USER\`  u_receiver     ON u_receiver.user_id = dr.receiver_id
      ${whereSQL}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];
    dbQueryLogger(dataSQL, dataParams);
    const [rows] = await pool.query(dataSQL, dataParams);

    return res.status(200).json({
      success: true,
      pagination: {
        total: Number(total), page, limit,
        totalPages: Math.ceil(total / limit),
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
//  GET /api/v1/deliveries/:id   [Auth]
// ─────────────────────────────────────────────────────────────────────────────
async function getDeliveryById(req, res, next) {
  try {
    const delivery_id = parseInt(req.params.id, 10);
    if (isNaN(delivery_id) || delivery_id < 1)
      return res.status(400).json({ success: false, error: 'delivery_id must be a positive integer' });

    const sql = `
      SELECT
        d.*,
        dr.pickup_note, dr.status AS request_status,
        f.food_name, f.food_type, f.quantity, f.description,
        u_donor.name     AS donor_name,    u_donor.location   AS donor_location,
        u_receiver.name  AS receiver_name,
        u_vol.name       AS volunteer_name
      FROM \`DELIVERY\` d
      JOIN \`DONATION_REQUEST\` dr  ON dr.request_id    = d.request_id
      JOIN \`FOOD_ITEM\`        f   ON f.food_id         = dr.food_id
      JOIN \`USER\`  u_donor        ON u_donor.user_id   = f.donor_id
      JOIN \`USER\`  u_receiver     ON u_receiver.user_id = dr.receiver_id
      LEFT JOIN \`USER\` u_vol      ON u_vol.user_id     = d.volunteer_id
      WHERE d.delivery_id = ?
    `;
    dbQueryLogger(sql, [delivery_id]);
    const [[row]] = await pool.execute(sql, [delivery_id]);

    if (!row)
      return res.status(404).json({ success: false, error: 'Delivery not found' });

    return res.status(200).json({ success: true, data: row });

  } catch (err) {
    next(err);
  }
}

module.exports = { updateDeliveryStatus, assignVolunteer, getMyDeliveries, getDeliveryById };
