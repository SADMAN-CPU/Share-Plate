'use strict';

const express = require('express');
const router  = express.Router();

const {
  addFood,
  getAvailableFood,
  getFoodById,
  updateFoodStatus,
  getMyListings,
  getDonorRequests,
} = require('../controllers/foodController');

const { verifyToken, verifyRole } = require('../middleware/auth');

// ── Public ───────────────────────────────────────────────────────────────────
// NOTE: specific named routes MUST come before /:id wildcard
router.get('/available',    getAvailableFood);

// ── Donor-protected named routes (before /:id) ───────────────────────────────
router.get('/my',           verifyToken, verifyRole('donor', 'admin'), getMyListings);
router.get('/my/requests',  verifyToken, verifyRole('donor', 'admin'), getDonorRequests);

// ── Public single-item route ─────────────────────────────────────────────────
router.get('/:id',          getFoodById);

// ── Protected mutation routes ────────────────────────────────────────────────
router.post('/add',         verifyToken, verifyRole('donor'), addFood);
router.patch('/:id/status', verifyToken, verifyRole('donor', 'admin'), updateFoodStatus);

module.exports = router;
