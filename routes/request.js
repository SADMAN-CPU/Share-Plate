'use strict';

/**
 * routes/request.js
 * Mounted at /api/v1/requests
 *
 *  POST   /create           – submit a donation request        [Receiver]
 *  GET    /mine             – list my requests                 [Any auth]
 *  GET    /:id              – get single request detail        [Any auth]
 *  PATCH  /:id/respond      – accept or reject a request       [Donor]
 */

const express = require('express');
const router  = express.Router();

const {
  createRequest,
  respondToRequest,
  getMyRequests,
  getRequestById,
} = require('../controllers/requestController');

const { verifyToken } = require('../middleware/auth');
const { verifyRole  } = require('../middleware/auth');

// Named sub-routes MUST come before /:id to avoid route-swallowing
router.post('/create',         verifyToken, verifyRole('receiver'),              createRequest);
router.get( '/mine',           verifyToken,                                      getMyRequests);
router.patch('/:id/respond',   verifyToken, verifyRole('donor'),                 respondToRequest);
router.get( '/:id',            verifyToken,                                      getRequestById);

module.exports = router;
