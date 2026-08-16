'use strict';

/**
 * middleware/auth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two reusable middleware functions for protecting Share Plate routes.
 *
 *   verifyToken          – validates the Bearer JWT; attaches decoded payload
 *                          to req.user = { sub, role, name, iat, exp }
 *
 *   verifyRole(...roles) – role-gate factory; call after verifyToken
 *                          e.g. verifyRole('admin')
 *                               verifyRole('donor', 'admin')
 * ─────────────────────────────────────────────────────────────────────────────
 */

const jwt = require('jsonwebtoken');

// ── verifyToken ───────────────────────────────────────────────────────────────
/**
 * Extracts the JWT from the Authorization header, verifies its signature
 * and expiry, then attaches the decoded payload to req.user.
 *
 * Expected header format:
 *   Authorization: Bearer <token>
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error:   'Unauthorized',
        message: 'No token provided. Include an Authorization: Bearer <token> header.',
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error:   'Unauthorized',
        message: 'Token is missing after "Bearer ".',
      });
    }

    // jwt.verify throws if the token is invalid, expired, or tampered with
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the full decoded payload so downstream handlers can read
    // req.user.sub  (user_id)
    // req.user.role
    // req.user.name
    req.user = decoded;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error:   'Token expired',
        message: 'Your session has expired. Please log in again.',
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error:   'Invalid token',
        message: 'The provided token is malformed or has an invalid signature.',
      });
    }

    // Unknown error – pass to global error handler
    next(err);
  }
}

// ── verifyRole ────────────────────────────────────────────────────────────────
/**
 * Role-gate middleware factory.
 *
 * Usage (in a route file):
 *   router.get('/admin-only', verifyToken, verifyRole('admin'), handler);
 *   router.post('/food',      verifyToken, verifyRole('donor', 'admin'), handler);
 *
 * @param  {...string} allowedRoles  One or more permitted role strings.
 * @returns {Function}               Express middleware
 */
function verifyRole(...allowedRoles) {
  // Flatten in case the caller passes an array: verifyRole(['admin', 'donor'])
  const roles = allowedRoles.flat();

  return function roleGate(req, res, next) {
    // verifyToken must run before verifyRole
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error:   'Unauthorized',
        message: 'Authentication required. Use verifyToken before verifyRole.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error:   'Forbidden',
        message: `Access denied. Required role: [${roles.join(' | ')}]. Your role: '${req.user.role}'.`,
      });
    }

    next();
  };
}

module.exports = { verifyToken, verifyRole };
