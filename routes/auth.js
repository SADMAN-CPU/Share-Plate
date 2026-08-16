'use strict';

/**
 * routes/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth routes mounted at /api/v1/auth in server.js.
 *
 *   POST  /api/v1/auth/register  – create a new user account
 *   POST  /api/v1/auth/login     – authenticate and receive a JWT
 *   GET   /api/v1/auth/me        – get the currently logged-in user (protected)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express    = require('express');
const router     = express.Router();

const { register, login, getMe } = require('../controllers/authController');
const { verifyToken }            = require('../middleware/auth');

// ── Public routes (no token required) ────────────────────────────────────────

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (donor | receiver | volunteer)
 * @access  Public
 * @body    { name, email, phone?, password, role?, location? }
 */
router.post('/register', register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return a signed JWT
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', login);

// ── Protected routes (token required) ────────────────────────────────────────

/**
 * @route   GET /api/v1/auth/me
 * @desc    Return the authenticated user's profile
 * @access  Private – any authenticated role
 */
router.get('/me', verifyToken, getMe);

module.exports = router;
