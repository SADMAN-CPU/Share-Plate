'use strict';

/**
 * routes/admin.js
 * Mounted at /api/v1/admin — ALL routes require Admin role
 */

const express = require('express');
const router  = express.Router();

const {
  getPlatformStats,
  getAllUsers,
  updateUserStatus,
  getAllFoodItems,
  flagFoodItem,
  manuallyExpireFood,
  getAllDeliveries,
  assignVolunteer,
} = require('../controllers/adminController');

const { verifyToken } = require('../middleware/auth');
const { verifyRole  } = require('../middleware/auth');

// All admin routes require a valid JWT + admin role
router.use(verifyToken, verifyRole('admin'));

router.get(  '/stats',                   getPlatformStats);
router.get(  '/users',                   getAllUsers);
router.patch('/users/:id/status',        updateUserStatus);
router.get(  '/food',                    getAllFoodItems);
router.patch('/food/:id/flag',           flagFoodItem);
router.patch('/food/:id/expire',         manuallyExpireFood);
router.get(  '/deliveries',              getAllDeliveries);
router.patch('/deliveries/:id/assign',   assignVolunteer);

module.exports = router;
