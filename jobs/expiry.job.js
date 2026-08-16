'use strict';

/**
 * jobs/expiry.job.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled cron job: Food Expiry Checker
 *
 * Schedule: every 15 minutes  (cron: "star/15 * * * *")
 *
 * What it does (in a single transaction):
 *  1. SELECT all FOOD_ITEM rows where expiry_time <= NOW()
 *     AND status IN ('available', 'reserved')
 *  2. Bulk UPDATE those rows -> status = 'expired'
 *  3. INSERT one NOTIFICATION row for each affected donor
 *  4. If a reserved item expires, also UPDATE the linked DONATION_REQUEST -> 'cancelled'
 *
 * Exported: startExpiryJob() — called once from server.js after DB connects.
 * ─────────────────────────────────────────────────────────────────────────────
 */


const cron     = require('node-cron');
const { pool } = require('../config/db');

/* ── Logging helpers ───────────────────────────────────────────────────────── */
const tag = '[EXPIRY JOB]';
const log  = (...args) => console.log(new Date().toISOString(), tag, ...args);
const warn = (...args) => console.warn(new Date().toISOString(), tag, ...args);

/* ── Core job logic ────────────────────────────────────────────────────────── */
async function runExpiryCheck() {
  log('⏰  Expiry check starting…');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    /* ── 1. Find expired items ─────────────────────────────────────────────── */
    const [expiredItems] = await conn.query(
      `SELECT food_id, donor_id, food_name, status
       FROM   FOOD_ITEM
       WHERE  expiry_time <= NOW()
         AND  status IN ('available', 'reserved')
       FOR UPDATE`,    // row-level lock prevents race with concurrent jobs
    );

    if (expiredItems.length === 0) {
      await conn.rollback();
      log('✅  No expired items found. Done.');
      return;
    }

    log(`⚠️  Found ${expiredItems.length} expired listing(s). Processing…`);

    const expiredIds = expiredItems.map((f) => f.food_id);

    /* ── 2. Bulk expire ────────────────────────────────────────────────────── */
    await conn.query(
      `UPDATE FOOD_ITEM
       SET    status = 'expired'
       WHERE  food_id IN (?)`,
      [expiredIds],
    );

    /* ── 3. Cancel pending/accepted DONATION_REQUESTs for reserved items ───── */
    const reservedIds = expiredItems
      .filter((f) => f.status === 'reserved')
      .map((f)    => f.food_id);

    if (reservedIds.length) {
      const [cancelResult] = await conn.query(
        `UPDATE DONATION_REQUEST
         SET    status = 'cancelled'
         WHERE  food_id IN (?)
           AND  status IN ('pending', 'accepted')`,
        [reservedIds],
      );
      log(`  ↪  Cancelled ${cancelResult.affectedRows} open donation request(s).`);
    }

    /* ── 4. Insert notifications (one per donor) ───────────────────────────── */
    // Group by donor_id in case they have multiple expired listings at once
    const byDonor = expiredItems.reduce((acc, food) => {
      if (!acc[food.donor_id]) acc[food.donor_id] = [];
      acc[food.donor_id].push(food.food_name);
      return acc;
    }, {});

    const notifRows = Object.entries(byDonor).map(([donorId, names]) => {
      const listStr = names.length === 1
        ? `"${names[0]}"`
        : `${names.slice(0, -1).map((n) => `"${n}"`).join(', ')} and "${names.at(-1)}"`;

      const message = names.length === 1
        ? `Your listing ${listStr} has expired and was automatically removed from available food.`
        : `${names.length} of your listings (${listStr}) have expired and were removed.`;

      return [
        parseInt(donorId),
        'Food listing(s) expired',
        message,
        'food_expired',
      ];
    });

    if (notifRows.length) {
      await conn.query(
        `INSERT INTO NOTIFICATION (user_id, title, message, type)
         VALUES ?`,
        [notifRows],
      );
    }

    await conn.commit();

    log(`✅  Expired ${expiredIds.length} listing(s). Notified ${notifRows.length} donor(s).`);
    expiredItems.forEach((f) =>
      log(`    → food_id=${f.food_id} | "${f.food_name}" | donor_id=${f.donor_id}`),
    );

  } catch (error) {
    await conn.rollback();
    warn('❌  Transaction rolled back due to error:', error.message);
    console.error(error);
  } finally {
    conn.release();
  }
}

/* ── Job starter ───────────────────────────────────────────────────────────── */
function startExpiryJob() {
  // Validate the cron expression before scheduling
  const SCHEDULE = process.env.EXPIRY_CRON ?? '*/15 * * * *';

  if (!cron.validate(SCHEDULE)) {
    warn(`❌  Invalid EXPIRY_CRON expression: "${SCHEDULE}". Job NOT started.`);
    return;
  }

  log(`📅  Scheduled to run: "${SCHEDULE}" (every 15 min by default)`);

  const job = cron.schedule(SCHEDULE, async () => {
    try {
      await runExpiryCheck();
    } catch (fatalErr) {
      // Catch anything missed by inner try/catch to keep the process alive
      warn('❌  Uncaught error in expiry job:', fatalErr.message);
    }
  }, {
    scheduled:   true,
    timezone:    process.env.TZ ?? 'UTC',
  });

  // Run once immediately on startup so stale items are expired right away
  log('🚀  Running initial expiry check on startup…');
  runExpiryCheck().catch((e) => warn('Startup check failed:', e.message));

  return job;   // caller can call job.stop() for graceful shutdown
}

module.exports = { startExpiryJob, runExpiryCheck };
