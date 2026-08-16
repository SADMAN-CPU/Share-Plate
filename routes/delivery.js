'use strict';

/**
 * routes/delivery.js
 * Mounted at /api/v1/deliveries
 *
 *  PUT    /update-status    – volunteer updates delivery status [Volunteer]
 *  GET    /mine             – volunteer's own deliveries        [Volunteer]
 *  PATCH  /:id/assign       – admin assigns a volunteer         [Admin]
 *  GET    /:id              – full delivery details             [Any auth]
 */

const express = require('express');
const router  = express.Router();

const {
  updateDeliveryStatus,
  assignVolunteer,
  getMyDeliveries,
  getDeliveryById,
} = require('../controllers/deliveryController');

const { verifyToken } = require('../middleware/auth');
const { verifyRole  } = require('../middleware/auth');

// Named routes before /:id
router.put(  '/update-status',  verifyToken, verifyRole('volunteer', 'admin'),   updateDeliveryStatus);
router.get(  '/mine',           verifyToken, verifyRole('volunteer'),             getMyDeliveries);
router.patch('/:id/assign',     verifyToken, verifyRole('admin'),                 assignVolunteer);
router.get(  '/:id',            verifyToken,                                      getDeliveryById);

module.exports = router;
