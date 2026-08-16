'use strict';

/**
 * database/initDB.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Run once (or on every deploy) to create the Share Plate database schema.
 *
 * Usage:
 *   node database/initDB.js
 *
 * The script is idempotent – CREATE TABLE ... IF NOT EXISTS means re-running it
 * on an existing database is safe and will only add missing tables.
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { dbQueryLogger } = require('../middleware/logger');

// ── 1. Create a temporary connection WITHOUT specifying the database so we can
//       run CREATE DATABASE if it doesn't already exist.
async function getBootstrapConnection() {
  return mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    charset:  'utf8mb4',
    timezone: '+00:00',
  });
}

// ── 2. Ordered DDL statements ─────────────────────────────────────────────────
//   Tables are created in dependency order so all referenced tables already
//   exist when a FOREIGN KEY constraint is added.

const DB_NAME = process.env.DB_NAME || 'share_plate_db';

const DDL_STATEMENTS = [

  // ── USER ────────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`USER\` (
    user_id     INT            NOT NULL AUTO_INCREMENT,
    name        VARCHAR(100)   NOT NULL,
    email       VARCHAR(150)   NOT NULL,
    phone       VARCHAR(20)    DEFAULT NULL,
    password    VARCHAR(255)   NOT NULL COMMENT 'bcrypt hash',
    role        ENUM('donor','receiver','volunteer','admin') NOT NULL DEFAULT 'receiver',
    status      ENUM('active','inactive','banned','suspended') NOT NULL DEFAULT 'active',
    is_verified TINYINT(1)     NOT NULL DEFAULT 0,
    location    VARCHAR(255)   DEFAULT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE  KEY uq_user_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── FOOD_ITEM ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`FOOD_ITEM\` (
    food_id     INT            NOT NULL AUTO_INCREMENT,
    donor_id    INT            NOT NULL COMMENT 'References USER(user_id)',
    food_name   VARCHAR(150)   NOT NULL,
    description TEXT           DEFAULT NULL,
    quantity    INT            NOT NULL DEFAULT 1,
    food_type   ENUM('cooked','raw','packaged','beverage','other') NOT NULL DEFAULT 'other',
    expiry_time DATETIME       DEFAULT NULL,
    status      ENUM('available','reserved','donated','expired') NOT NULL DEFAULT 'available',
    is_flagged  TINYINT(1)     NOT NULL DEFAULT 0,
    flag_reason TEXT           DEFAULT NULL,
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (food_id),
    CONSTRAINT fk_food_item_donor
      FOREIGN KEY (donor_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── FOOD_SAFETY_CHECKLIST ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`FOOD_SAFETY_CHECKLIST\` (
    checklist_id       INT  NOT NULL AUTO_INCREMENT,
    food_id            INT  NOT NULL,
    is_freshly_cooked  TINYINT(1) NOT NULL DEFAULT 0,
    proper_packaging   TINYINT(1) NOT NULL DEFAULT 0,
    hygiene_maintained TINYINT(1) NOT NULL DEFAULT 0,
    allergen_declared  TINYINT(1) NOT NULL DEFAULT 0,
    is_approved        TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Set by admin/volunteer reviewer',
    reviewed_at        DATETIME   DEFAULT NULL,
    PRIMARY KEY (checklist_id),
    UNIQUE KEY uq_checklist_food (food_id),
    CONSTRAINT fk_checklist_food
      FOREIGN KEY (food_id) REFERENCES \`FOOD_ITEM\` (food_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── DONATION_REQUEST ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`DONATION_REQUEST\` (
    request_id   INT          NOT NULL AUTO_INCREMENT,
    food_id      INT          NOT NULL,
    receiver_id  INT          NOT NULL,
    status       ENUM('pending','accepted','rejected','completed','cancelled') NOT NULL DEFAULT 'pending',
    pickup_note  TEXT         DEFAULT NULL,
    requested_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (request_id),
    CONSTRAINT fk_req_food
      FOREIGN KEY (food_id) REFERENCES \`FOOD_ITEM\` (food_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_req_receiver
      FOREIGN KEY (receiver_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── DELIVERY ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`DELIVERY\` (
    delivery_id    INT      NOT NULL AUTO_INCREMENT,
    request_id     INT      NOT NULL,
    volunteer_id   INT      NOT NULL COMMENT 'The volunteer handling pickup/drop',
    status         ENUM('assigned','picked_up','delivered','failed') NOT NULL DEFAULT 'assigned',
    pickup_time    DATETIME DEFAULT NULL,
    delivered_time DATETIME DEFAULT NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (delivery_id),
    UNIQUE KEY uq_delivery_request (request_id),
    CONSTRAINT fk_delivery_request
      FOREIGN KEY (request_id) REFERENCES \`DONATION_REQUEST\` (request_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_delivery_volunteer
      FOREIGN KEY (volunteer_id) REFERENCES \`USER\` (user_id)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── REVIEW ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`REVIEW\` (
    review_id           INT            NOT NULL AUTO_INCREMENT,
    delivery_id         INT            NOT NULL,
    reviewer_id         INT            NOT NULL COMMENT 'User who wrote the review',
    food_quality_rating TINYINT        NOT NULL DEFAULT 0 COMMENT '1–5 scale',
    donor_service_rating TINYINT       NOT NULL DEFAULT 0 COMMENT '1–5 scale',
    comment             TEXT           DEFAULT NULL,
    created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id),
    CONSTRAINT fk_review_delivery
      FOREIGN KEY (delivery_id) REFERENCES \`DELIVERY\` (delivery_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_review_reviewer
      FOREIGN KEY (reviewer_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_food_rating    CHECK (food_quality_rating    BETWEEN 1 AND 5),
    CONSTRAINT chk_service_rating CHECK (donor_service_rating   BETWEEN 1 AND 5)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── NOTIFICATION ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`NOTIFICATION\` (
    notification_id INT          NOT NULL AUTO_INCREMENT,
    user_id         INT          NOT NULL,
    title           VARCHAR(150) NOT NULL DEFAULT 'Notification',
    message         TEXT         NOT NULL,
    type            ENUM(
      'food_expired','food_flagged','request_update',
      'delivery_update','general','badge'
    ) NOT NULL DEFAULT 'general',
    is_read         TINYINT(1)   NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notif_user (user_id),
    CONSTRAINT fk_notif_user
      FOREIGN KEY (user_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── MESSAGE ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`MESSAGE\` (
    message_id  INT      NOT NULL AUTO_INCREMENT,
    sender_id   INT      NOT NULL,
    receiver_id INT      NOT NULL,
    request_id  INT      DEFAULT NULL COMMENT 'Optional: links message to a donation request thread',
    content     TEXT     NOT NULL,
    is_read     TINYINT(1) NOT NULL DEFAULT 0,
    sent_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id),
    KEY idx_message_sender   (sender_id),
    KEY idx_message_receiver (receiver_id),
    KEY idx_message_request  (request_id),
    CONSTRAINT fk_message_sender
      FOREIGN KEY (sender_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_message_receiver
      FOREIGN KEY (receiver_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_message_request
      FOREIGN KEY (request_id) REFERENCES \`DONATION_REQUEST\` (request_id)
      ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── BADGE ────────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS \`BADGE\` (
    badge_id        INT          NOT NULL AUTO_INCREMENT,
    user_id         INT          NOT NULL,
    badge_name      VARCHAR(100) NOT NULL,
    badge_type      ENUM('donation','volunteer','community','milestone') NOT NULL DEFAULT 'milestone',
    milestone_value INT          NOT NULL DEFAULT 0 COMMENT 'e.g. donated 10 meals',
    earned_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (badge_id),
    KEY idx_badge_user (user_id),
    CONSTRAINT fk_badge_user
      FOREIGN KEY (user_id) REFERENCES \`USER\` (user_id)
      ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// ── 3. Runner ────────────────────────────────────────────────────────────────
async function initDB() {
  let bootstrapConn;

  try {
    // Step A: create the database if needed
    bootstrapConn = await getBootstrapConnection();
    const createDbSQL = `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
    dbQueryLogger(createDbSQL);
    await bootstrapConn.execute(createDbSQL);
    console.log(`[DB] ✅  Database \`${DB_NAME}\` ready`);

    await bootstrapConn.changeUser({ database: DB_NAME });

    // Step B: run every DDL statement in order
    for (const sql of DDL_STATEMENTS) {
      dbQueryLogger(sql);
      await bootstrapConn.execute(sql);
    }

    console.log('[DB] ✅  All 9 tables created / verified successfully');
    console.log('\n  Tables in share_plate_db:\n');
    console.log('  ┌─────────────────────────────┐');
    [
      'USER',
      'FOOD_ITEM',
      'FOOD_SAFETY_CHECKLIST',
      'DONATION_REQUEST',
      'DELIVERY',
      'REVIEW',
      'NOTIFICATION',
      'MESSAGE',
      'BADGE',
    ].forEach(t => console.log(`  │  ${t.padEnd(27)}│`));
    console.log('  └─────────────────────────────┘\n');

  } catch (err) {
    console.error('[DB] ❌  Schema initialization failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (bootstrapConn) await bootstrapConn.end();
  }
}

// Allow running directly: `node database/initDB.js`
initDB();
