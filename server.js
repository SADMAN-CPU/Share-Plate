'use strict';

/**
 * server.js – Share Plate API Server
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point for the Share Plate backend.
 *
 * Start dev server:
 *   npm run devStart        (uses nodemon)
 *   node server.js          (plain Node)
 *
 * Env vars: see .env.example
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 0. Load environment variables FIRST (before any other import reads process.env)
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const { testConnection }   = require('./config/db');
const { requestLogger }    = require('./middleware/logger');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const foodRoutes         = require('./routes/food');
const requestRoutes      = require('./routes/request');
const deliveryRoutes     = require('./routes/delivery');
const reviewRoutes       = require('./routes/review');
const notificationRoutes = require('./routes/notification'); // Phase 7 ✅
const adminRoutes        = require('./routes/admin');        // Phase 7 ✅

// ── Scheduled jobs ────────────────────────────────────────────────────────────
const { startExpiryJob } = require('./jobs/expiry.job');    // Phase 7 ✅

// ── 1. App instance ──────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ── 2. Trust proxy (important when deployed behind nginx / reverse proxy)
app.set('trust proxy', 1);

// ── 3. Core middleware ───────────────────────────────────────────────────────

// CORS – restrict origins in production via ALLOWED_ORIGINS env var
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps in dev)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  methods:            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:     ['Content-Type', 'Authorization'],
  exposedHeaders:     ['X-Total-Count'],
  credentials:        true,
  optionsSuccessStatus: 200,
}));

// Parse incoming JSON – reject payloads larger than 1 MB
app.use(express.json({ limit: '1mb' }));

// Parse URL-encoded bodies (form submissions)
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Custom colourised request logger (logs method, path, status, ms)
app.use(requestLogger);

// ── 4. Health-check ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status:    'ok',
    service:   'share-plate-api',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── 5. API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          authRoutes);         // Phase 2 ✅
app.use('/api/v1/food',          foodRoutes);         // Phase 3 ✅
app.use('/api/v1/requests',      requestRoutes);      // Phase 4 ✅
app.use('/api/v1/deliveries',    deliveryRoutes);     // Phase 4 ✅
app.use('/api/v1/reviews',       reviewRoutes);       // Phase 4 ✅
app.use('/api/v1/notifications', notificationRoutes); // Phase 7 ✅
app.use('/api/v1/admin',         adminRoutes);        // Phase 7 ✅

// Future:
//  app.use('/api/v1/messages', messageRoutes); // Phase 8
//  app.use('/api/v1/badges',   badgeRoutes);   // Phase 8

// ── 6. 404 handler (must come AFTER all routes) ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error:   'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// ── 7. Global error handler (4 args = Express recognises it as error middleware)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // CORS errors bubble up here
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: err.message });
  }

  // JSON parse errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message    = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  console.error(`[ERROR] ${statusCode} – ${err.message}`);
  if (statusCode === 500) console.error(err.stack);

  res.status(statusCode).json({ success: false, error: message });
});

// ── 8. Boot sequence ─────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Verify DB is reachable before accepting HTTP traffic
    await testConnection();

    // ── Start background jobs ────────────────────────────────────────────────
    const expiryJob = startExpiryJob();

    const server = app.listen(PORT, () => {
      const border = '─'.repeat(52);
      console.log(`\n  ┌${border}┐`);
      console.log(`  │  🍽️   Share Plate API Server                      │`);
      console.log(`  ├${border}┤`);
      console.log(`  │  Port    : ${String(PORT).padEnd(40)}│`);
      console.log(`  │  Env     : ${String(process.env.NODE_ENV || 'development').padEnd(40)}│`);
      console.log(`  │  Health  : http://localhost:${PORT}/health          │`);
      console.log(`  │  Cron    : Expiry check every 15 min               │`);
      console.log(`  └${border}┘\n`);
    });

    // ── 9. Graceful shutdown ─────────────────────────────────────────────────
    function shutdown(signal) {
      console.log(`\n[SERVER] ${signal} received – shutting down gracefully…`);

      // Stop the cron job so no new runs start
      if (expiryJob) expiryJob.stop();

      server.close(() => {
        console.log('[SERVER] HTTP server closed. Goodbye! 👋');
        process.exit(0);
      });

      // Force exit if connections don't drain within 10 s
      setTimeout(() => {
        console.error('[SERVER] Forced exit after timeout');
        process.exit(1);
      }, 10_000).unref();
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[SERVER] ❌  Failed to start:', err.message);
    process.exit(1);
  }
}

startServer();