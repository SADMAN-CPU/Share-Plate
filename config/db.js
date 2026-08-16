'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

/**
 * Connection pool – reuses DB connections instead of opening a new one per query.
 * Pool size, timeouts and charset are all configurable via env vars.
 */
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'share_plate_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+00:00',
});

/**
 * Lightweight helper called once at server startup to confirm DB reachability.
 * Throws on failure so the process exits early with a clear error instead of
 * crashing on the first incoming request.
 */
async function testConnection() {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  console.log('[DB] ✅  Connected to MySQL database:', process.env.DB_NAME || 'share_plate_db');
}

module.exports = { pool, testConnection };
