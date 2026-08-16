'use strict';

/**
 * routes/review.js
 * Mounted at /api/v1/reviews
 *
 *  POST  /add                – submit a review after delivery   [Receiver]
 *  GET   /food/:food_id      – all reviews for a food listing   [Public]
 *  GET   /donor/:user_id     – all reviews received by a donor  [Public]
 */

const express = require('express');
const router  = express.Router();

const {
  addReview,
  getReviewsByFood,
  getReviewsByUser,
} = require('../controllers/reviewController');

const { verifyToken } = require('../middleware/auth');
const { verifyRole  } = require('../middleware/auth');

router.post('/add',              verifyToken, verifyRole('receiver'),  addReview);
router.get( '/food/:food_id',                                          getReviewsByFood);
router.get( '/donor/:user_id',                                         getReviewsByUser);

module.exports = router;
