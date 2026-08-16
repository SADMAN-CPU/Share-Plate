'use strict';

/**
 * controllers/foodController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles food listing operations for the Share Plate platform.
 *
 * Exports:
 *   addFood(req, res, next)           – POST /api/v1/food/add          [Donor]
 *   getAvailableFood(req, res, next)  – GET  /api/v1/food/available     [Any]
 *   getFoodById(req, res, next)       – GET  /api/v1/food/:id           [Any]
 *   updateFoodStatus(req, res, next)  – PATCH /api/v1/food/:id/status  [Donor|Admin]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }          = require('../config/db');
const { dbQueryLogger } = require('../middleware/logger');

// ─────────────────────────────────────────────────────────────────────────────
//  Constants & Validators
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FOOD_TYPES = ['cooked', 'raw', 'packaged', 'beverage', 'other'];
const VALID_STATUSES   = ['available', 'reserved', 'donated', 'expired'];

/**
 * Validates the FOOD_ITEM fields from the request body.
 * Returns an array of error strings (empty = valid).
 */
function validateFoodItem(body) {
  const errors = [];
  const { food_name, quantity, food_type, expiry_time } = body;

  if (!food_name || typeof food_name !== 'string' || food_name.trim().length < 2)
    errors.push('food_name must be at least 2 characters');

  if (quantity === undefined || quantity === null)
    errors.push('quantity is required');
  else if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)
    errors.push('quantity must be a positive integer');

  if (food_type && !VALID_FOOD_TYPES.includes(food_type))
    errors.push(`food_type must be one of: ${VALID_FOOD_TYPES.join(', ')}`);

  if (expiry_time) {
    const d = new Date(expiry_time);
    if (isNaN(d.getTime()))
      errors.push('expiry_time must be a valid ISO 8601 date-time string');
    else if (d <= new Date())
      errors.push('expiry_time must be in the future');
  }

  return errors;
}

/**
 * Validates the FOOD_SAFETY_CHECKLIST fields.
 * All 4 boolean fields must be present and explicitly true to allow listing.
 * Returns an array of error strings (empty = valid).
 */
function validateChecklist(body) {
  const errors = [];
  const CHECKLIST_FIELDS = [
    'is_freshly_cooked',
    'proper_packaging',
    'hygiene_maintained',
    'allergen_declared',
  ];

  for (const field of CHECKLIST_FIELDS) {
    if (body[field] === undefined || body[field] === null) {
      errors.push(`${field} is required (true or false)`);
    } else if (typeof body[field] !== 'boolean' && body[field] !== 0 && body[field] !== 1) {
      errors.push(`${field} must be a boolean (true/false)`);
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/food/add   [Donor only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Adds a new food listing along with its safety checklist in a single
 * database transaction.  If either INSERT fails the entire operation is
 * rolled back so the DB is never left in a partial state.
 *
 * Body:
 * {
 *   food_name, description?, quantity, food_type?, expiry_time?,
 *   is_freshly_cooked, proper_packaging, hygiene_maintained, allergen_declared
 * }
 */
async function addFood(req, res, next) {
  const conn = await pool.getConnection();   // Grab a dedicated connection for the transaction

  try {
    const {
      food_name,
      description   = null,
      quantity,
      food_type     = 'other',
      expiry_time   = null,
      // Checklist fields
      is_freshly_cooked,
      proper_packaging,
      hygiene_maintained,
      allergen_declared,
    } = req.body;

    // ── 1. Validate ────────────────────────────────────────────────────────
    const foodErrors      = validateFoodItem(req.body);
    const checklistErrors = validateChecklist(req.body);
    const allErrors       = [...foodErrors, ...checklistErrors];

    if (allErrors.length) {
      conn.release();
      return res.status(400).json({ success: false, errors: allErrors });
    }

    // ── 2. Begin transaction ───────────────────────────────────────────────
    await conn.beginTransaction();

    // ── 3. Insert FOOD_ITEM ────────────────────────────────────────────────
    const foodSQL = `
      INSERT INTO \`FOOD_ITEM\`
        (donor_id, food_name, description, quantity, food_type, expiry_time, status)
      VALUES (?, ?, ?, ?, ?, ?, 'available')
    `;
    const foodParams = [
      req.user.sub,          // donor_id comes from the verified JWT
      food_name.trim(),
      description,
      Number(quantity),
      food_type,
      expiry_time ? new Date(expiry_time) : null,
    ];
    dbQueryLogger(foodSQL, foodParams);
    const [foodResult] = await conn.execute(foodSQL, foodParams);
    const food_id = foodResult.insertId;

    // ── 4. Insert FOOD_SAFETY_CHECKLIST (linked to the new food_id) ────────
    const checklistSQL = `
      INSERT INTO \`FOOD_SAFETY_CHECKLIST\`
        (food_id, is_freshly_cooked, proper_packaging, hygiene_maintained, allergen_declared, is_approved)
      VALUES (?, ?, ?, ?, ?, 0)
    `;
    const checklistParams = [
      food_id,
      is_freshly_cooked ? 1 : 0,
      proper_packaging  ? 1 : 0,
      hygiene_maintained ? 1 : 0,
      allergen_declared  ? 1 : 0,
    ];
    dbQueryLogger(checklistSQL, checklistParams);
    await conn.execute(checklistSQL, checklistParams);

    // ── 5. Commit both inserts atomically ──────────────────────────────────
    await conn.commit();

    // ── 6. Fetch the complete record to return to the client ───────────────
    const fetchSQL = `
      SELECT
        f.*,
        c.checklist_id,
        c.is_freshly_cooked,
        c.proper_packaging,
        c.hygiene_maintained,
        c.allergen_declared,
        c.is_approved
      FROM \`FOOD_ITEM\` f
      JOIN \`FOOD_SAFETY_CHECKLIST\` c ON c.food_id = f.food_id
      WHERE f.food_id = ?
    `;
    dbQueryLogger(fetchSQL, [food_id]);
    const [[newListing]] = await conn.execute(fetchSQL, [food_id]);

    return res.status(201).json({
      success: true,
      message: 'Food listing created successfully',
      data:    newListing,
    });

  } catch (err) {
    // Roll back if anything went wrong inside the transaction
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/food/available   [Public]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns paginated food listings that are:
 *   • status = 'available'
 *   • expiry_time IS NULL  OR  expiry_time > NOW()
 *
 * Query parameters:
 *   page        {number}  default 1
 *   limit       {number}  default 10, max 50
 *   food_type   {string}  filter by food type  (cooked | raw | packaged | beverage | other)
 *   search      {string}  partial match on food_name or description
 *   donor_id    {number}  show listings from a specific donor
 *   sort        {string}  'newest' (default) | 'expiry'
 */
async function getAvailableFood(req, res, next) {
  try {
    // ── 1. Parse & validate query params ──────────────────────────────────
    let page  = parseInt(req.query.page,  10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;

    if (page  < 1)  page  = 1;
    if (limit < 1)  limit = 10;
    if (limit > 50) limit = 50;            // cap to prevent DB overload

    const offset    = (page - 1) * limit;
    const { food_type, search, donor_id, sort } = req.query;

    // Validate optional food_type filter
    if (food_type && !VALID_FOOD_TYPES.includes(food_type)) {
      return res.status(400).json({
        success: false,
        error:   `Invalid food_type. Must be one of: ${VALID_FOOD_TYPES.join(', ')}`,
      });
    }

    // ── 2. Build dynamic WHERE clauses ────────────────────────────────────
    const whereClauses = [
      "f.status = 'available'",
      "(f.expiry_time IS NULL OR f.expiry_time > NOW())",
    ];
    const queryParams = [];

    if (food_type) {
      whereClauses.push('f.food_type = ?');
      queryParams.push(food_type);
    }

    if (search && search.trim()) {
      whereClauses.push('(f.food_name LIKE ? OR f.description LIKE ?)');
      const term = `%${search.trim()}%`;
      queryParams.push(term, term);
    }

    if (donor_id) {
      const parsedDonorId = parseInt(donor_id, 10);
      if (isNaN(parsedDonorId) || parsedDonorId < 1) {
        return res.status(400).json({ success: false, error: 'donor_id must be a positive integer' });
      }
      whereClauses.push('f.donor_id = ?');
      queryParams.push(parsedDonorId);
    }

    const whereSQL = whereClauses.join(' AND ');

    // ── 3. ORDER BY ────────────────────────────────────────────────────────
    // 'expiry' sorts by soonest-expiring first (most urgent)
    // 'newest' sorts by most recently posted
    const orderSQL = sort === 'expiry'
      ? 'ORDER BY ISNULL(f.expiry_time) ASC, f.expiry_time ASC'
      : 'ORDER BY f.created_at DESC';

    // ── 4. COUNT query (for pagination metadata) ───────────────────────────
    const countSQL = `
      SELECT COUNT(*) AS total
      FROM \`FOOD_ITEM\` f
      WHERE ${whereSQL}
    `;
    dbQueryLogger(countSQL, queryParams);
    const [[{ total }]] = await pool.query(countSQL, queryParams);

    // ── 5. Data query ──────────────────────────────────────────────────────
    const dataSQL = `
      SELECT
        f.food_id,
        f.food_name,
        f.description,
        f.quantity,
        f.food_type,
        f.expiry_time,
        f.status,
        f.created_at,
        -- Donor summary (name + location only, never email/phone/password)
        u.user_id   AS donor_id,
        u.name      AS donor_name,
        u.location  AS donor_location,
        -- Safety checklist summary
        c.is_freshly_cooked,
        c.proper_packaging,
        c.hygiene_maintained,
        c.allergen_declared,
        c.is_approved AS checklist_approved
      FROM \`FOOD_ITEM\` f
      JOIN \`USER\`               u ON u.user_id  = f.donor_id
      LEFT JOIN \`FOOD_SAFETY_CHECKLIST\` c ON c.food_id  = f.food_id
      WHERE ${whereSQL}
      ${orderSQL}
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...queryParams, limit, offset];
    dbQueryLogger(dataSQL, dataParams);
    const [rows] = await pool.query(dataSQL, dataParams);

    // ── 6. Respond with pagination envelope ───────────────────────────────
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      pagination: {
        total:       Number(total),
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters: {
        food_type: food_type || null,
        search:    search    || null,
        donor_id:  donor_id  || null,
        sort:      sort      || 'newest',
      },
      data: rows,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/food/:id   [Any]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns full details for a single food listing, including its safety
 * checklist.  Does NOT restrict by status so that donors can view their
 * own expired/donated items.
 */
async function getFoodById(req, res, next) {
  try {
    const food_id = parseInt(req.params.id, 10);

    if (isNaN(food_id) || food_id < 1) {
      return res.status(400).json({ success: false, error: 'food_id must be a positive integer' });
    }

    const sql = `
      SELECT
        f.*,
        u.name      AS donor_name,
        u.location  AS donor_location,
        c.checklist_id,
        c.is_freshly_cooked,
        c.proper_packaging,
        c.hygiene_maintained,
        c.allergen_declared,
        c.is_approved AS checklist_approved,
        c.reviewed_at
      FROM \`FOOD_ITEM\` f
      JOIN \`USER\`               u ON u.user_id = f.donor_id
      LEFT JOIN \`FOOD_SAFETY_CHECKLIST\` c ON c.food_id = f.food_id
      WHERE f.food_id = ?
    `;
    dbQueryLogger(sql, [food_id]);
    const [[row]] = await pool.execute(sql, [food_id]);

    if (!row) {
      return res.status(404).json({ success: false, error: 'Food listing not found' });
    }

    return res.status(200).json({ success: true, data: row });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/v1/food/:id/status   [Donor (own) | Admin]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Allows a donor to update the status of their own listing
 * (e.g. mark as donated/expired) or an admin to update any listing.
 *
 * Body: { status: 'available' | 'reserved' | 'donated' | 'expired' }
 */
async function updateFoodStatus(req, res, next) {
  try {
    const food_id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(food_id) || food_id < 1)
      return res.status(400).json({ success: false, error: 'food_id must be a positive integer' });

    if (!status || !VALID_STATUSES.includes(status))
      return res.status(400).json({
        success: false,
        error:   `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });

    // Fetch current record to check ownership
    const checkSQL = 'SELECT donor_id, status FROM `FOOD_ITEM` WHERE food_id = ?';
    dbQueryLogger(checkSQL, [food_id]);
    const [[item]] = await pool.execute(checkSQL, [food_id]);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Food listing not found' });
    }

    // Only the donor who created it or an admin may update it
    if (req.user.role !== 'admin' && item.donor_id !== req.user.sub) {
      return res.status(403).json({
        success: false,
        error:   'Forbidden',
        message: 'You can only update your own listings.',
      });
    }

    const updateSQL = 'UPDATE `FOOD_ITEM` SET status = ? WHERE food_id = ?';
    dbQueryLogger(updateSQL, [status, food_id]);
    await pool.execute(updateSQL, [status, food_id]);

    return res.status(200).json({
      success: true,
      message: `Food listing status updated to '${status}'`,
      data:    { food_id, status },
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/food/my   [Donor only — ALL their listings, any status]
// ─────────────────────────────────────────────────────────────────────────────
async function getMyListings(req, res, next) {
  try {
    const donor_id = req.user.sub;
    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const whereClauses = ['f.donor_id = ?'];
    const params = [donor_id];
    if (status && VALID_STATUSES.includes(status)) {
      whereClauses.push('f.status = ?');
      params.push(status);
    }
    const whereSQL = `WHERE ${whereClauses.join(' AND ')}`;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`FOOD_ITEM\` f ${whereSQL}`, params
    );

    const dataSQL = `
      SELECT
        f.food_id, f.food_name, f.description, f.quantity, f.food_type,
        f.expiry_time, f.status, f.is_flagged, f.flag_reason, f.created_at,
        c.is_freshly_cooked, c.proper_packaging, c.hygiene_maintained,
        c.allergen_declared, c.is_approved,
        (SELECT COUNT(*) FROM \`DONATION_REQUEST\` dr WHERE dr.food_id = f.food_id) AS request_count
      FROM \`FOOD_ITEM\` f
      LEFT JOIN \`FOOD_SAFETY_CHECKLIST\` c ON c.food_id = f.food_id
      ${whereSQL}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;
    dbQueryLogger(dataSQL, [...params, limit, offset]);
    const [rows] = await pool.query(dataSQL, [...params, limit, offset]);

    return res.status(200).json({
      success: true,
      pagination: {
        total: Number(total), page, limit,
        totalPages: Math.ceil(total / limit),
      },
      data: rows,
    });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/food/my/requests   [Donor — all incoming requests on their food]
// ─────────────────────────────────────────────────────────────────────────────
async function getDonorRequests(req, res, next) {
  try {
    const donor_id = req.user.sub;
    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`DONATION_REQUEST\` dr
       JOIN \`FOOD_ITEM\` f ON f.food_id = dr.food_id
       WHERE f.donor_id = ?`,
      [donor_id]
    );

    const [rows] = await pool.query(
      `SELECT dr.request_id, dr.status, dr.pickup_note, dr.requested_at,
              f.food_id, f.food_name, f.quantity,
              u.name AS receiver_name, u.phone AS receiver_phone,
              d.delivery_id, d.status AS delivery_status
       FROM \`DONATION_REQUEST\` dr
       JOIN \`FOOD_ITEM\` f ON f.food_id = dr.food_id
       JOIN \`USER\` u ON u.user_id = dr.receiver_id
       LEFT JOIN \`DELIVERY\` d ON d.request_id = dr.request_id
       WHERE f.donor_id = ?
       ORDER BY dr.requested_at DESC
       LIMIT ? OFFSET ?`,
      [donor_id, limit, offset]
    );

    return res.status(200).json({
      success: true,
      pagination: { total: Number(total), page, limit },
      data: rows,
    });
  } catch (err) { next(err); }
}

module.exports = { addFood, getAvailableFood, getFoodById, updateFoodStatus, getMyListings, getDonorRequests };

