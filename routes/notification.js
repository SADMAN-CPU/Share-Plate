'use strict';

/**
 * routes/notification.js
 * Mounted at /api/v1/notifications
 *
 *  GET    /mine          – list my notifications       [Any auth]
 *  GET    /unread-count  – badge count for navbar bell [Any auth]
 *  PATCH  /read-all      – mark all read               [Any auth]
 *  PATCH  /:id/read      – mark one read               [Any auth]
 */

const express = require('express');
const router  = express.Router();

const {
  getMyNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
} = require('../controllers/notificationController');

const { verifyToken } = require('../middleware/auth');

// Named routes BEFORE /:id
router.get(  '/mine',         verifyToken, getMyNotifications);
router.get(  '/unread-count', verifyToken, getUnreadCount);
router.patch('/read-all',     verifyToken, markAllRead);
router.patch('/:id/read',     verifyToken, markOneRead);

module.exports = router;
