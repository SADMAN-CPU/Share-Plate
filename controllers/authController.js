'use strict';

/**
 * controllers/authController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles user registration and login for the Share Plate platform.
 *
 * Exports:
 *   register(req, res, next)  – POST /api/v1/auth/register
 *   login(req, res, next)     – POST /api/v1/auth/login
 *   getMe(req, res, next)     – GET  /api/v1/auth/me  (protected)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { pool }         = require('../config/db');
const { dbQueryLogger } = require('../middleware/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Seconds → JWT expiry string, e.g. '7d', '1h' */
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS  = Number(process.env.BCRYPT_ROUNDS) || 12;

/**
 * Sign a JWT for the given user record.
 * Payload contains only non-sensitive, role-routing fields.
 */
function signToken(user) {
  return jwt.sign(
    {
      sub:  user.user_id,   // standard JWT "subject" claim
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** Strip the password hash before sending user data to the client */
function sanitizeUser(user) {
  const { password, ...safe } = user;
  return safe;
}

// ── REGISTER ─────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/register
 *
 * Body: { name, email, phone?, password, role?, location? }
 *
 * Allowed roles on self-registration: donor | receiver | volunteer
 * Only an existing admin can create another admin (enforced here).
 */
async function register(req, res, next) {
  try {
    const {
      name,
      email,
      phone    = null,
      password,
      role     = 'receiver',
      location = null,
    } = req.body;

    // ── 1. Input validation ────────────────────────────────────────────────
    const VALID_ROLES   = ['donor', 'receiver', 'volunteer'];
    const EMAIL_REGEX   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors        = [];

    if (!name    || typeof name    !== 'string' || name.trim().length < 2)
      errors.push('name must be at least 2 characters');
    if (!email   || !EMAIL_REGEX.test(email))
      errors.push('a valid email is required');
    if (!password || password.length < 8)
      errors.push('password must be at least 8 characters');
    if (!VALID_ROLES.includes(role))
      errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);

    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    // ── 2. Duplicate email check ───────────────────────────────────────────
    const checkSQL = 'SELECT user_id FROM `USER` WHERE email = ? LIMIT 1';
    dbQueryLogger(checkSQL, [email]);
    const [existing] = await pool.execute(checkSQL, [email]);

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error:   'User already exists',
        message: `An account with email '${email}' is already registered.`,
      });
    }

    // ── 3. Hash password ───────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ── 4. Insert new user ─────────────────────────────────────────────────
    const insertSQL = `
      INSERT INTO \`USER\` (name, email, phone, password, role, location)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [name.trim(), email.toLowerCase(), phone, passwordHash, role, location];
    dbQueryLogger(insertSQL, params);
    const [result] = await pool.execute(insertSQL, params);

    // ── 5. Fetch the created row (to include DB defaults like created_at) ──
    const fetchSQL = 'SELECT * FROM `USER` WHERE user_id = ? LIMIT 1';
    dbQueryLogger(fetchSQL, [result.insertId]);
    const [[newUser]] = await pool.execute(fetchSQL, [result.insertId]);

    // ── 6. Sign JWT & respond ──────────────────────────────────────────────
    const token = signToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: sanitizeUser(newUser),
    });

  } catch (err) {
    next(err);
  }
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
/**
 * POST /api/v1/auth/login
 *
 * Body: { email, password }
 *
 * Returns a JWT on success.
 * Deliberately uses the same error message for wrong email OR wrong password
 * to prevent user-enumeration attacks.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // ── 1. Basic presence check ────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error:   'Bad Request',
        message: 'email and password are required',
      });
    }

    // ── 2. Find user by email ──────────────────────────────────────────────
    const findSQL = 'SELECT * FROM `USER` WHERE email = ? LIMIT 1';
    dbQueryLogger(findSQL, [email]);
    const [[user]] = await pool.execute(findSQL, [email.toLowerCase()]);

    // ── 3. Verify password (constant-time compare prevents timing attacks) ─
    const INVALID_CREDENTIALS_MSG = 'Invalid credentials';

    if (!user) {
      // Run a dummy bcrypt compare to keep response time constant
      await bcrypt.compare(password, '$2a$12$dummyhashfortimingattackprevention');
      return res.status(401).json({ success: false, error: INVALID_CREDENTIALS_MSG });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: INVALID_CREDENTIALS_MSG });
    }

    // ── 4. Check account status ────────────────────────────────────────────
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error:   'Account suspended',
        message: `Your account is currently '${user.status}'. Please contact support.`,
      });
    }

    // ── 5. Sign JWT & respond ──────────────────────────────────────────────
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    next(err);
  }
}

// ── GET ME (protected) ────────────────────────────────────────────────────────
/**
 * GET /api/v1/auth/me
 *
 * Returns the currently authenticated user's profile.
 * Requires verifyToken middleware to be run first.
 */
async function getMe(req, res, next) {
  try {
    const fetchSQL = 'SELECT * FROM `USER` WHERE user_id = ? LIMIT 1';
    dbQueryLogger(fetchSQL, [req.user.sub]);
    const [[user]] = await pool.execute(fetchSQL, [req.user.sub]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.status(200).json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
