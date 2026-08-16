'use strict';

/**
 * database/seed.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the database with realistic demo data for all 4 roles:
 *  - 1 Admin
 *  - 2 Donors  (with food listings + safety checklists)
 *  - 2 Receivers
 *  - 2 Volunteers
 * Also seeds donation requests, deliveries, reviews & notifications.
 *
 * Run:  node database/seed.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'share_plate_db';
const SALT    = 10;
const PASS    = 'Password123!';   // same password for every demo account

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: DB_NAME,
    charset:  'utf8mb4',
  });

  console.log('\n🌱  Seeding Share Plate database…\n');

  try {
    // ── 0. Wipe existing seed data (safe re-run) ──────────────────────────────
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['NOTIFICATION','REVIEW','DELIVERY','DONATION_REQUEST',
                     'FOOD_SAFETY_CHECKLIST','FOOD_ITEM','USER']) {
      await conn.query(`TRUNCATE TABLE \`${t}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ Cleared old seed data');

    // ── 1. Users ──────────────────────────────────────────────────────────────
    const hash = await bcrypt.hash(PASS, SALT);

    const users = [
      // role,        name,                  email,                        phone,          location,          verified
      ['admin',     'MD SADMAN SHAID',        'admin@shareplate.com',       '01700000001',  'Dhaka HQ',        1],
      ['donor',     'Fatima Malik',          'fatima@example.com',         '01711111111',  'Gulshan, Dhaka',  1],
      ['donor',     'Kabir Hossain',         'kabir@example.com',          '01722222222',  'Dhanmondi, Dhaka',1],
      ['receiver',  'Nasrin Akter',          'nasrin@example.com',         '01733333333',  'Mirpur, Dhaka',   0],
      ['receiver',  'Rahim Uddin',           'rahim@example.com',          '01744444444',  'Mohammadpur',     0],
      ['volunteer', 'Tariq Ahmed',           'tariq@example.com',          '01755555555',  'Banani, Dhaka',   1],
      ['volunteer', 'Sumaiya Chowdhury',     'sumaiya@example.com',        '01766666666',  'Uttara, Dhaka',   1],
    ];

    const userIds = {};
    for (const [role, name, email, phone, location, is_verified] of users) {
      const [r] = await conn.query(
        `INSERT INTO USER (name, email, phone, password, role, location, is_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, hash, role, location, is_verified],
      );
      userIds[email] = r.insertId;
      console.log(`  ✓ User [${role.padEnd(9)}] ${name} (${email})`);
    }

    const donor1    = userIds['fatima@example.com'];
    const donor2    = userIds['kabir@example.com'];
    const receiver1 = userIds['nasrin@example.com'];
    const receiver2 = userIds['rahim@example.com'];
    const volunteer1 = userIds['tariq@example.com'];

    // ── 2. Food Items ─────────────────────────────────────────────────────────
    console.log('\n  Seeding food listings…');

    const now    = new Date();
    const plus   = (h) => new Date(now.getTime() + h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
    const minus  = (h) => new Date(now.getTime() - h * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');

    const foods = [
      // donor_id, food_name,              description,                                   qty, food_type,  expiry,    status
      [donor1, 'Chicken Biryani',       'Freshly cooked, serves 4 people',              4,   'cooked',   plus(6),   'available'],
      [donor1, 'Mixed Vegetable Curry', 'Vegan, no allergens, warm and fresh',          3,   'cooked',   plus(4),   'available'],
      [donor1, 'Bread Loaf (x3)',       'Sealed packaged bread, best by tomorrow',      3,   'packaged', plus(20),  'available'],
      [donor2, 'Dal and Rice',          'Lentil soup with steamed rice, serves 6',      6,   'cooked',   plus(5),   'reserved'],
      [donor2, 'Orange Juice (1L)',     'Tetra pack, unopened, expires next week',      2,   'beverage', plus(168), 'available'],
      [donor2, 'Old Khichuri',          'Already donated — test donated status',        2,   'cooked',   minus(2),  'donated'],
      [donor1, 'Expired Halwa',         'Auto-expired test item',                       1,   'cooked',   minus(3),  'expired'],
    ];

    const foodIds = [];
    for (const [donor_id, food_name, description, quantity, food_type, expiry_time, status] of foods) {
      const [r] = await conn.query(
        `INSERT INTO FOOD_ITEM (donor_id, food_name, description, quantity, food_type, expiry_time, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [donor_id, food_name, description, quantity, food_type, expiry_time, status],
      );
      foodIds.push(r.insertId);
      console.log(`  ✓ Food  [${status.padEnd(9)}] "${food_name}"`);
    }

    // ── 3. Food Safety Checklists ─────────────────────────────────────────────
    const checklists = [
      // food_id,     fresh, packaged, hygiene, allergen
      [foodIds[0],  1, 1, 1, 0],
      [foodIds[1],  1, 1, 1, 1],
      [foodIds[2],  0, 1, 1, 0],
      [foodIds[3],  1, 1, 1, 0],
      [foodIds[4],  0, 1, 1, 1],
      [foodIds[5],  1, 1, 1, 0],
      [foodIds[6],  1, 0, 1, 0],
    ];

    for (const [food_id, fresh, pkg, hygiene, allergen] of checklists) {
      await conn.query(
        `INSERT INTO FOOD_SAFETY_CHECKLIST
           (food_id, is_freshly_cooked, proper_packaging, hygiene_maintained, allergen_declared)
         VALUES (?, ?, ?, ?, ?)`,
        [food_id, fresh, pkg, hygiene, allergen],
      );
    }
    console.log('  ✓ Safety checklists inserted');

    // ── 4. Donation Requests ──────────────────────────────────────────────────
    console.log('\n  Seeding donation requests…');

    // Request for the "Dal and Rice" (reserved item)
    const [req1] = await conn.query(
      `INSERT INTO DONATION_REQUEST (food_id, receiver_id, status, pickup_note)
       VALUES (?, ?, 'accepted', 'I can pick up between 5–7 pm today')`,
      [foodIds[3], receiver1],
    );
    console.log('  ✓ Request #1 — Nasrin requested "Dal and Rice" [accepted]');

    // Request for donated item (completed)
    const [req2] = await conn.query(
      `INSERT INTO DONATION_REQUEST (food_id, receiver_id, status, pickup_note)
       VALUES (?, ?, 'completed', NULL)`,
      [foodIds[5], receiver2],
    );
    console.log('  ✓ Request #2 — Rahim requested "Old Khichuri" [completed]');

    // ── 5. Deliveries ─────────────────────────────────────────────────────────
    console.log('\n  Seeding deliveries…');

    // Active delivery (in progress)
    const [del1] = await conn.query(
      `INSERT INTO DELIVERY (request_id, volunteer_id, status, pickup_time)
       VALUES (?, ?, 'picked_up', NOW())`,
      [req1.insertId, volunteer1],
    );
    console.log('  ✓ Delivery #1 — Tariq is delivering "Dal and Rice" [picked_up]');

    // Completed delivery
    const [del2] = await conn.query(
      `INSERT INTO DELIVERY (request_id, volunteer_id, status, pickup_time, delivered_time)
       VALUES (?, ?, 'delivered', DATE_SUB(NOW(), INTERVAL 2 HOUR), NOW())`,
      [req2.insertId, volunteer1],
    );
    console.log('  ✓ Delivery #2 — "Old Khichuri" delivered [delivered]');

    // ── 6. Reviews ────────────────────────────────────────────────────────────
    await conn.query(
      `INSERT INTO REVIEW (delivery_id, reviewer_id, food_quality_rating, donor_service_rating, comment)
       VALUES (?, ?, 5, 5, 'Absolutely delicious and the donor was very kind. Will request again!')`,
      [del2.insertId, receiver2],
    );
    console.log('\n  ✓ Review added for completed delivery (5★)');

    // ── 7. Notifications ──────────────────────────────────────────────────────
    const notifs = [
      [donor1,    'Listing expired',         '"Expired Halwa" was automatically expired by the system.',       'food_expired'],
      [donor2,    'Request received!',        'Nasrin Akter has requested your "Dal and Rice" listing.',       'request_update'],
      [receiver1, 'Request accepted',         'Your request for "Dal and Rice" has been accepted. Stand by!',  'request_update'],
      [volunteer1,'New delivery assigned',    'You have been assigned to deliver "Dal and Rice" (ID #1).',     'delivery_update'],
      [receiver2, 'Delivery completed',       'Your food "Old Khichuri" was delivered. Thank you!',           'delivery_update'],
    ];

    for (const [user_id, title, message, type] of notifs) {
      await conn.query(
        `INSERT INTO NOTIFICATION (user_id, title, message, type) VALUES (?, ?, ?, ?)`,
        [user_id, title, message, type],
      );
    }
    console.log('  ✓ Notifications seeded');

    // ── Done! ─────────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log('🎉  Seed complete! Login credentials:\n');
    console.log('  Role       Email                         Password');
    console.log('  ─────────  ────────────────────────────  ──────────────');
    console.log('  Admin      admin@shareplate.com           Password123!');
    console.log('  Donor      fatima@example.com             Password123!');
    console.log('  Donor      kabir@example.com              Password123!');
    console.log('  Receiver   nasrin@example.com             Password123!');
    console.log('  Receiver   rahim@example.com              Password123!');
    console.log('  Volunteer  tariq@example.com              Password123!');
    console.log('  Volunteer  sumaiya@example.com            Password123!');
    console.log('\n  All accounts use the same password: Password123!');
    console.log('─'.repeat(60) + '\n');

  } catch (err) {
    console.error('\n❌  Seed failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

seed();
