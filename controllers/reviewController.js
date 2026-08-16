'use strict';

/**
 * controllers/reviewController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles post-delivery reviews from receivers.
 *
 * Exports:
 *   addReview(req, res, next)          – POST /api/v1/reviews/add           [Receiver]
 *   getReviewsByFood(req, res, next)   – GET  /api/v1/reviews/food/:food_id  [Public]
 *   getReviewsByUser(req, res, next)   – GET  /api/v1/reviews/donor/:user_id [Public]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }          = require('../config/db');
const { dbQueryLogger } = require('../middleware/logger');

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/reviews/add   [Receiver only]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * A receiver submits a review after their food has been delivered.
 *
 * Business rules:
 *  1. delivery_id must exist.
 *  2. The delivery must be in 'delivered' status (not picked_up, assigned, etc.)
 *  3. The caller must be the receiver of the associated donation request.
 *  4. Only one review is allowed per delivery (unique constraint on delivery_id
 *     in REVIEW — duplicates also rejected here at app-level for a cleaner message).
 *  5. Ratings must be 1–5.
 *
 * Body:
 * {
 *   delivery_id,
 *   food_quality_rating,    // 1–5
 *   donor_service_rating,   // 1–5
 *   comment?
 * }
 */
async function addReview(req, res, next) {
  try {
    const {
      delivery_id,
      food_quality_rating,
      donor_service_rating,
      comment = null,
    } = req.body;
    const reviewer_id = req.user.sub;

    // ── 1. Validate inputs ────────────────────────────────────────────────
    const errors = [];

    if (!delivery_id || !Number.isInteger(Number(delivery_id)) || Number(delivery_id) < 1)
      errors.push('delivery_id must be a positive integer');

    const fqr = Number(food_quality_rating);
    const dsr = Number(donor_service_rating);

    if (isNaN(fqr) || fqr < 1 || fqr > 5 || !Number.isInteger(fqr))
      errors.push('food_quality_rating must be an integer between 1 and 5');

    if (isNaN(dsr) || dsr < 1 || dsr > 5 || !Number.isInteger(dsr))
      errors.push('donor_service_rating must be an integer between 1 and 5');

    if (errors.length)
      return res.status(400).json({ success: false, errors });

    // ── 2. Fetch delivery + request to validate eligibility ───────────────
    const delivSQL = `
      SELECT
        d.delivery_id, d.status AS delivery_status,
        d.request_id,
        dr.receiver_id, dr.food_id
      FROM \`DELIVERY\` d
      JOIN \`DONATION_REQUEST\` dr ON dr.request_id = d.request_id
      WHERE d.delivery_id = ?
    `;
    dbQueryLogger(delivSQL, [delivery_id]);
    const [[delivery]] = await pool.execute(delivSQL, [Number(delivery_id)]);

    if (!delivery)
      return res.status(404).json({ success: false, error: 'Delivery not found' });

    // ── 3. Business rule: delivery must be completed ──────────────────────
    if (delivery.delivery_status !== 'delivered') {
      return res.status(409).json({
        success: false,
        error:   'Review not allowed yet',
        message: `Delivery is currently '${delivery.delivery_status}'. You can only review after the food has been delivered.`,
      });
    }

    // ── 4. Business rule: reviewer must be the receiver ───────────────────
    if (delivery.receiver_id !== reviewer_id) {
      return res.status(403).json({
        success: false,
        error:   'Forbidden',
        message: 'Only the receiver of this donation can submit a review.',
      });
    }

    // ── 5. Duplicate review check ─────────────────────────────────────────
    const dupSQL = 'SELECT review_id FROM `REVIEW` WHERE delivery_id = ? AND reviewer_id = ? LIMIT 1';
    dbQueryLogger(dupSQL, [delivery_id, reviewer_id]);
    const [[dup]] = await pool.execute(dupSQL, [Number(delivery_id), reviewer_id]);

    if (dup) {
      return res.status(409).json({
        success: false,
        error:   'Duplicate review',
        message: 'You have already submitted a review for this delivery.',
      });
    }

    // ── 6. Insert the review ──────────────────────────────────────────────
    const insertSQL = `
      INSERT INTO \`REVIEW\`
        (delivery_id, reviewer_id, food_quality_rating, donor_service_rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `;
    const params = [Number(delivery_id), reviewer_id, fqr, dsr, comment];
    dbQueryLogger(insertSQL, params);
    const [result] = await pool.execute(insertSQL, params);

    // ── 7. Return full review record ──────────────────────────────────────
    const fetchSQL = `
      SELECT
        r.*,
        u_reviewer.name AS reviewer_name,
        f.food_name,
        u_donor.name    AS donor_name
      FROM \`REVIEW\` r
      JOIN \`USER\`              u_reviewer ON u_reviewer.user_id = r.reviewer_id
      JOIN \`DELIVERY\`          d          ON d.delivery_id       = r.delivery_id
      JOIN \`DONATION_REQUEST\`  dr         ON dr.request_id       = d.request_id
      JOIN \`FOOD_ITEM\`         f          ON f.food_id           = dr.food_id
      JOIN \`USER\`              u_donor    ON u_donor.user_id     = f.donor_id
      WHERE r.review_id = ?
    `;
    dbQueryLogger(fetchSQL, [result.insertId]);
    const [[newReview]] = await pool.execute(fetchSQL, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully. Thank you for your feedback!',
      data:    newReview,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/food/:food_id   [Public]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns all reviews for a specific food listing,
 * including average ratings computed from the result set.
 */
async function getReviewsByFood(req, res, next) {
  try {
    const food_id = parseInt(req.params.food_id, 10);
    if (isNaN(food_id) || food_id < 1)
      return res.status(400).json({ success: false, error: 'food_id must be a positive integer' });

    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    // Avg ratings summary
    const summarySQL = `
      SELECT
        COUNT(*)                           AS total_reviews,
        ROUND(AVG(r.food_quality_rating),  2) AS avg_food_quality,
        ROUND(AVG(r.donor_service_rating), 2) AS avg_donor_service
      FROM \`REVIEW\` r
      JOIN \`DELIVERY\`         d  ON d.delivery_id = r.delivery_id
      JOIN \`DONATION_REQUEST\` dr ON dr.request_id = d.request_id
      WHERE dr.food_id = ?
    `;
    dbQueryLogger(summarySQL, [food_id]);
    const [[summary]] = await pool.execute(summarySQL, [food_id]);

    const dataSQL = `
      SELECT
        r.review_id, r.food_quality_rating, r.donor_service_rating, r.comment, r.created_at,
        u_reviewer.name AS reviewer_name
      FROM \`REVIEW\` r
      JOIN \`USER\`              u_reviewer ON u_reviewer.user_id = r.reviewer_id
      JOIN \`DELIVERY\`          d          ON d.delivery_id       = r.delivery_id
      JOIN \`DONATION_REQUEST\`  dr         ON dr.request_id       = d.request_id
      WHERE dr.food_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    dbQueryLogger(dataSQL, [food_id, limit, offset]);
    const [rows] = await pool.query(dataSQL, [food_id, limit, offset]);

    return res.status(200).json({
      success: true,
      summary: {
        total_reviews:     Number(summary.total_reviews),
        avg_food_quality:  summary.avg_food_quality  ? Number(summary.avg_food_quality)  : null,
        avg_donor_service: summary.avg_donor_service ? Number(summary.avg_donor_service) : null,
      },
      pagination: {
        total: Number(summary.total_reviews), page, limit,
        totalPages:  Math.ceil(summary.total_reviews / limit),
        hasNextPage: page < Math.ceil(summary.total_reviews / limit),
        hasPrevPage: page > 1,
      },
      data: rows,
    });

  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/reviews/donor/:user_id   [Public]
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns all reviews received by a specific donor,
 * aggregated from all their food listings.
 */
async function getReviewsByUser(req, res, next) {
  try {
    const donor_id = parseInt(req.params.user_id, 10);
    if (isNaN(donor_id) || donor_id < 1)
      return res.status(400).json({ success: false, error: 'user_id must be a positive integer' });

    let page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    let limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const summarySQL = `
      SELECT
        COUNT(*)                           AS total_reviews,
        ROUND(AVG(r.food_quality_rating),  2) AS avg_food_quality,
        ROUND(AVG(r.donor_service_rating), 2) AS avg_donor_service
      FROM \`REVIEW\` r
      JOIN \`DELIVERY\`         d  ON d.delivery_id = r.delivery_id
      JOIN \`DONATION_REQUEST\` dr ON dr.request_id = d.request_id
      JOIN \`FOOD_ITEM\`        f  ON f.food_id     = dr.food_id
      WHERE f.donor_id = ?
    `;
    dbQueryLogger(summarySQL, [donor_id]);
    const [[summary]] = await pool.execute(summarySQL, [donor_id]);

    const dataSQL = `
      SELECT
        r.review_id, r.food_quality_rating, r.donor_service_rating, r.comment, r.created_at,
        f.food_name,
        u_reviewer.name AS reviewer_name
      FROM \`REVIEW\` r
      JOIN \`USER\`              u_reviewer ON u_reviewer.user_id = r.reviewer_id
      JOIN \`DELIVERY\`          d          ON d.delivery_id       = r.delivery_id
      JOIN \`DONATION_REQUEST\`  dr         ON dr.request_id       = d.request_id
      JOIN \`FOOD_ITEM\`         f          ON f.food_id           = dr.food_id
      WHERE f.donor_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    dbQueryLogger(dataSQL, [donor_id, limit, offset]);
    const [rows] = await pool.query(dataSQL, [donor_id, limit, offset]);

    return res.status(200).json({
      success: true,
      summary: {
        total_reviews:     Number(summary.total_reviews),
        avg_food_quality:  summary.avg_food_quality  ? Number(summary.avg_food_quality)  : null,
        avg_donor_service: summary.avg_donor_service ? Number(summary.avg_donor_service) : null,
      },
      pagination: {
        total: Number(summary.total_reviews), page, limit,
        totalPages:  Math.ceil(summary.total_reviews / limit),
        hasNextPage: page < Math.ceil(summary.total_reviews / limit),
        hasPrevPage: page > 1,
      },
      data: rows,
    });

  } catch (err) {
    next(err);
  }
}

module.exports = { addReview, getReviewsByFood, getReviewsByUser };
