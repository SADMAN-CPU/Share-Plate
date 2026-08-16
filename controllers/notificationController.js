'use strict';

/**
 * controllers/notificationController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles in-app notifications stored in the NOTIFICATION table.
 *
 * Endpoints:
 *  GET    /notifications/mine       – paginated list for current user
 *  GET    /notifications/unread-count
 *  PATCH  /notifications/:id/read  – mark one as read
 *  PATCH  /notifications/read-all  – mark all as read
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool }        = require('../config/db');
const { dbQueryLogger: logQuery } = require('../middleware/logger');

/* ── helper — send JSON + log ──────────────────────────────────────────────── */
const ok  = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const err = (res, msg, status = 400)  => res.status(status).json({ success: false, message: msg });

/* ══════════════════════════════════════════════════════════════════════════════
   GET /notifications/mine
   Returns paginated notifications for the authenticated user, newest first.
══════════════════════════════════════════════════════════════════════════════ */
async function getMyNotifications(req, res, next) {
  try {
    const userId = req.user.sub;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM NOTIFICATION WHERE user_id = ?',
      [userId],
    );
    logQuery('COUNT NOTIFICATION', [userId]);

    const [rows] = await pool.query(
      `SELECT notification_id, title, message, type, is_read, created_at
       FROM   NOTIFICATION
       WHERE  user_id = ?
       ORDER  BY created_at DESC
       LIMIT  ? OFFSET ?`,
      [userId, limit, offset],
    );
    logQuery('SELECT NOTIFICATION', [userId, limit, offset]);

    return ok(res, {
      data: rows,
      pagination: {
        total, page, limit,
        totalPages:  Math.ceil(total / limit),
        unreadCount: rows.filter((n) => !n.is_read).length,
      },
    });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   GET /notifications/unread-count
   Lightweight endpoint used by the navbar bell badge.
══════════════════════════════════════════════════════════════════════════════ */
async function getUnreadCount(req, res, next) {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM NOTIFICATION WHERE user_id = ? AND is_read = 0',
      [req.user.sub],
    );
    logQuery('COUNT UNREAD NOTIFICATIONS', [req.user.sub]);
    return ok(res, { count });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /notifications/:id/read
   Mark a single notification as read (must belong to current user).
══════════════════════════════════════════════════════════════════════════════ */
async function markOneRead(req, res, next) {
  try {
    const userId         = req.user.sub;
    const notificationId = parseInt(req.params.id);
    if (!notificationId) return err(res, 'Invalid notification ID');

    const [result] = await pool.query(
      'UPDATE NOTIFICATION SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
      [notificationId, userId],
    );
    logQuery('UPDATE NOTIFICATION read', [notificationId, userId]);

    if (result.affectedRows === 0) return err(res, 'Notification not found', 404);
    return ok(res, { message: 'Notification marked as read' });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   PATCH /notifications/read-all
   Mark every unread notification for the current user as read.
══════════════════════════════════════════════════════════════════════════════ */
async function markAllRead(req, res, next) {
  try {
    const [result] = await pool.query(
      'UPDATE NOTIFICATION SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.sub],
    );
    logQuery('UPDATE ALL NOTIFICATIONS read', [req.user.sub]);
    return ok(res, { message: `${result.affectedRows} notification(s) marked as read` });
  } catch (e) { next(e); }
}

/* ══════════════════════════════════════════════════════════════════════════════
   Shared utility — insert a notification row (used by cron + other controllers)
   Exported so the expiry job and other controllers can reuse it.
══════════════════════════════════════════════════════════════════════════════ */
async function createNotification(conn, { userId, title, message, type = 'general' }) {
  const [res] = await conn.query(
    `INSERT INTO NOTIFICATION (user_id, title, message, type)
     VALUES (?, ?, ?, ?)`,
    [userId, title, message, type],
  );
  return res.insertId;
}

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  createNotification,   // shared utility
};
