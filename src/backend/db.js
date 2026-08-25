const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'roster.db');
const db = new sqlite3.Database(dbPath);

// Helper to run SQL
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Helper to query all rows
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper to query single row
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

async function initDb() {
  // Create users table for authentication & admin verification
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Staff', -- 'Admin', 'Staff', 'Viewer'
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      approved_at TEXT,
      approved_by TEXT
    )
  `);

  // Seed Registered Admin Account (ID: 12345 / Password: CLICKME)
  const clickmeHash = await bcrypt.hash('CLICKME', 10);
  const primaryAdmin = await get("SELECT * FROM users WHERE username = '12345'");
  if (!primaryAdmin) {
    await run(
      `INSERT INTO users (username, name, email, password_hash, role, status, approved_at, approved_by)
       VALUES (?, ?, ?, ?, 'Admin', 'APPROVED', CURRENT_TIMESTAMP, 'SYSTEM')`,
      ['12345', 'Railway Officer / Administrator', 'admin12345@railway.gov.in', clickmeHash]
    );
    console.log('Admin account registered (ID: 12345 / Password: CLICKME)');
  } else {
    // Ensure password and role are updated to CLICKME / Admin
    await run(
      `UPDATE users SET password_hash = ?, role = 'Admin', status = 'APPROVED' WHERE username = '12345'`,
      [clickmeHash]
    );
  }
  // Create tables
  await run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      cycle_length INTEGER NOT NULL,
      anchor_date TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      link_number INTEGER NOT NULL,
      train_numbers TEXT,
      from_station TEXT,
      to_station TEXT,
      coaches TEXT,
      is_rest BOOLEAN DEFAULT 0,
      effective_from TEXT NOT NULL,
      effective_to TEXT DEFAULT '9999-12-31',
      set_type TEXT DEFAULT '2-Day Set',
      set_name TEXT
    )
  `);

  try {
    await run(`ALTER TABLE links ADD COLUMN set_type TEXT DEFAULT '2-Day Set'`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    await run(`ALTER TABLE links ADD COLUMN set_name TEXT`);
  } catch (e) {
    // Ignore if column already exists
  }

  await run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      designation TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      row_position INTEGER NOT NULL,
      active BOOLEAN DEFAULT 1,
      join_date TEXT,
      leave_date TEXT,
      UNIQUE(category_id, row_position)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      original_link_number INTEGER,
      overridden_link_number INTEGER, -- NULL means REST
      reason TEXT NOT NULL,
      created_by TEXT DEFAULT 'Admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL, -- 'LEAVE', 'SWAP'
      swap_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      reason TEXT,
      approved_by TEXT,
      approved_at TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_role TEXT,
      action_type TEXT,
      description TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS duty_register_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      page_number INTEGER,
      train_out TEXT,
      coach_out TEXT,
      train_return TEXT,
      coach_return TEXT,
      duty_label TEXT,
      notes TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS duty_register_staff (
      entry_id INTEGER REFERENCES duty_register_entry(id) ON DELETE CASCADE,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      UNIQUE(entry_id, staff_id)
    )
  `);

  // Check if categories are seeded
  const catCount = await get('SELECT COUNT(*) as count FROM categories');
  if (catCount.count === 0) {
    console.log('Seeding database...');
    // Seed Categories
    await run(`INSERT INTO categories (id, name, code, cycle_length, anchor_date) VALUES 
      (1, 'Conductors (COR)', 'COR', 21, '2026-08-01'),
      (2, 'TTI / Sleeper Staff', 'TTI_SLEEPER', 63, '2026-08-01'),
      (3, 'Ladies Staff / TTE', 'LADIES_TTE', 7, '2026-08-01')
    `);

    // Seed COR links (21 links)
    const corLinks = [
      { num: 1, trains: 'PILOT(67230),17225', from: 'GNT/BZA', to: 'BZA/GTL (Day 1)', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (17225/26)', set_type: '3-Day Set' },
      { num: 2, trains: '17225,17226', from: 'BZA/GTL (Day 2)', to: 'GTL/BZA (Day 1)', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (17225/26)', set_type: '3-Day Set' },
      { num: 3, trains: '17226,PILOT(12703)', from: 'GTL/BZA (Day 2)', to: 'BZA/GNT', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (17225/26)', set_type: '3-Day Set' },
      { num: 4, trains: '17261', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'AC', rest: 0, set_name: 'GNT-TPTY Exp (17261/12733)', set_type: '3-Day Set' },
      { num: 5, trains: '17261,12733', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'H1, A1-A3 & B5', rest: 0, set_name: 'GNT-TPTY Exp (17261/12733)', set_type: '3-Day Set' },
      { num: 6, trains: '12733', from: 'TPTY/GNT (Day 2)', to: 'GNT', coaches: 'H1, A1-A3 & B5', rest: 0, set_name: 'GNT-TPTY Exp (17261/12733)', set_type: '3-Day Set' },
      { num: 7, trains: 'REST', from: '', to: '', coaches: '', rest: 1, set_name: 'Weekly Rest 1', set_type: 'Other / REST' },
      { num: 8, trains: '20629', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'AC', rest: 0, set_name: 'VB & Narayanadri Exp', set_type: '3-Day Set' },
      { num: 9, trains: '20629,12733', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'M1 & B1-B4', rest: 0, set_name: 'VB & Narayanadri Exp', set_type: '3-Day Set' },
      { num: 10, trains: '12733,12734', from: 'TPTY/GNT (Day 2)', to: 'GNT/TPTY (Day 1)', coaches: 'M1 & B1-B4 / H1, A1-A3 & B5', rest: 0, set_name: 'VB & Narayanadri Exp', set_type: '3-Day Set' },
      { num: 11, trains: '12734,20630', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'H1, A1-A3 & B5 / AC', rest: 0, set_name: 'Narayanadri & VB Exp', set_type: '3-Day Set' },
      { num: 12, trains: '20630,12604', from: 'TPTY/GNT (Day 2)', to: 'GNT/MAS (Day 1)', coaches: 'AC', rest: 0, set_name: 'Narayanadri & VB Exp', set_type: '3-Day Set' },
      { num: 13, trains: '12604,12603', from: 'GNT/MAS (Day 2)', to: 'MAS/GNT', coaches: 'AC', rest: 0, set_name: 'Narayanadri & VB Exp', set_type: '3-Day Set' },
      { num: 14, trains: 'REST', from: '', to: '', coaches: '', rest: 1, set_name: 'Weekly Rest 2', set_type: 'Other / REST' },
      { num: 15, trains: 'PILOT(67230),18047', from: 'GNT/BZA', to: 'BZA/GTL (Day 1)', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (18047/48)', set_type: '3-Day Set' },
      { num: 16, trains: '18047,18048', from: 'BZA/GTL (Day 2)', to: 'GTL/BZA (Day 1)', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (18047/48)', set_type: '3-Day Set' },
      { num: 17, trains: '18048,PILOT(12703)', from: 'GTL/BZA (Day 2)', to: 'BZA/GNT', coaches: 'AC', rest: 0, set_name: 'Amaravati Exp (18047/48)', set_type: '3-Day Set' },
      { num: 18, trains: '12734', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'M1 & B1-B4', rest: 0, set_name: 'Narayanadri & TPTY Exp', set_type: '3-Day Set' },
      { num: 19, trains: '12734,17262', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'M1 & B1-B4 / AC', rest: 0, set_name: 'Narayanadri & TPTY Exp', set_type: '3-Day Set' },
      { num: 20, trains: '17262', from: 'TPTY/GNT (Day 2)', to: 'GNT', coaches: 'AC', rest: 0, set_name: 'Narayanadri & TPTY Exp', set_type: '3-Day Set' },
      { num: 21, trains: 'REST', from: '', to: '', coaches: '', rest: 1, set_name: 'Weekly Rest 3', set_type: 'Other / REST' }
    ];
 
    for (const link of corLinks) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_name, set_type) 
         VALUES (1, ?, ?, ?, ?, ?, ?, '2026-07-01', ?, ?)`,
        [link.num, link.trains, link.from, link.to, link.coaches, link.rest, link.set_name, link.set_type]
      );
    }
 
    // Seed COR Staff (21 staff members)
    const corStaff = Array.from({ length: 21 }, (_, i) => ({
      name: `Employee ${i + 1}`,
      desg: 'CTI',
      pos: i + 1
    }));
 
    for (const person of corStaff) {
      await run(
        `INSERT INTO staff (name, designation, category_id, row_position, active, join_date) 
         VALUES (?, ?, 1, ?, 1, '2026-07-01')`,
        [person.name, person.desg, person.pos]
      );
    }
 
    // Seed TTI/Sleeper Links (63 links)
    const sleeperLinks = [
      { num: 1, trains: '17253', from: 'GNT', to: 'DHNE', coaches: 'AC+SL', rest: 0 },
      { num: 2, trains: '17252', from: 'DHNE', to: 'GNT', coaches: 'AC+SL', rest: 0 },
      { num: 3, trains: '12604', from: 'GNT', to: 'GNT/MAS (Day 1)', coaches: 'S1-S5', rest: 0 },
      { num: 4, trains: '12604,12603', from: 'GNT/MAS (Day 2)', to: 'MAS/GNT', coaches: 'S1-S5', rest: 0 },
      { num: 5, trains: '17251', from: 'GNT', to: 'GNT/DHNE (Day 1)', coaches: 'AC+SL', rest: 0 },
      { num: 6, trains: '17251,17254', from: 'GNT/DHNE (Day 2)', to: 'DHNE/GNT', coaches: 'AC+SL', rest: 0 },
      { num: 7, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 8, trains: '20629', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'S1-S4', rest: 0 },
      { num: 9, trains: '20629,17262', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'S1-S4', rest: 0 },
      { num: 10, trains: '17262', from: 'TPTY/GNT (Day 2)', to: 'GNT', coaches: 'S1-S4', rest: 0 },
      { num: 11, trains: 'PILOT(67230),17225', from: 'GNT/BZA', to: 'BZA/GTL (Day 1)', coaches: 'S1-S5', rest: 0 },
      { num: 12, trains: '17225,17226', from: 'BZA/GTL (Day 2)', to: 'GTL/BZA (Day 1)', coaches: 'S1-S5', rest: 0 },
      { num: 13, trains: '17226,PILOT(12703)', from: 'GTL/BZA (Day 2)', to: 'BZA/GNT', coaches: 'S1-S5', rest: 0 },
      { num: 14, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 15, trains: '17253', from: 'GNT', to: 'DHNE', coaches: 'SL', rest: 0 },
      { num: 16, trains: '17252', from: 'DHNE', to: 'GNT', coaches: 'SL', rest: 0 },
      { num: 17, trains: 'PILOT(12705),12795', from: 'GNT/BZA', to: 'BZA/SC', coaches: 'AC+2S', rest: 0 },
      { num: 18, trains: '17645', from: 'SC', to: 'GNT', coaches: 'AC+SL', rest: 0 },
      { num: 19, trains: '12805', from: 'GNT', to: 'SC', coaches: 'AC+2S', rest: 0 },
      { num: 20, trains: '12806,PILOT(17240)', from: 'SC/BZA', to: 'BZA/GNT', coaches: 'AC+2S', rest: 0 },
      { num: 21, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 22, trains: '20629', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'S5-S8', rest: 0 },
      { num: 23, trains: '20629,20630', from: 'GNT/TPTY (Day 2)', to: 'TPTY/GNT (Day 1)', coaches: 'S5-S8', rest: 0 },
      { num: 24, trains: '20630', from: 'TPTY/GNT (Day 2)', to: 'GNT', coaches: 'S5-S8', rest: 0 },
      { num: 25, trains: 'PILOT(67230),17225', from: 'GNT/BZA', to: 'BZA/GTL (Day 1)', coaches: 'S6-S10', rest: 0 },
      { num: 26, trains: '17225,17226', from: 'BZA/GTL (Day 2)', to: 'GTL/BZA (Day 1)', coaches: 'S6-S10', rest: 0 },
      { num: 27, trains: '17226,PILOT(12703)', from: 'GTL/BZA (Day 2)', to: 'BZA/GNT', coaches: 'S6-S10', rest: 0 },
      { num: 28, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 29, trains: '17239', from: 'GNT', to: 'VSKP', coaches: 'CC+2S', rest: 0 },
      { num: 30, trains: '17240', from: 'VSKP', to: 'GNT', coaches: 'CC+2S', rest: 0 },
      { num: 31, trains: '17281', from: 'GNT', to: 'NS', coaches: '2S', rest: 0 },
      { num: 32, trains: '17282', from: 'NS', to: 'GNT', coaches: '2S', rest: 0 },
      { num: 33, trains: '17646', from: 'GNT', to: 'SC', coaches: 'AC+SL', rest: 0 },
      { num: 34, trains: '12796,12805', from: 'SC/BZA', to: 'BZA/GNT', coaches: 'AC+2S', rest: 0 },
      { num: 35, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 36, trains: '17645,17626', from: 'GNT/RAL', to: 'RAL/SC (Day 1)', coaches: 'AC + SL', rest: 0 },
      { num: 37, trains: '17626,17625', from: 'RAL/SC (Day 2)/KCG', to: 'SC/RAL (Day 1)', coaches: 'AC + SL', rest: 0 },
      { num: 38, trains: '17625,17646', from: 'SC/RAL (Day 2)/RAL', to: 'RAL/GNT', coaches: 'AC + SL', rest: 0 },
      { num: 39, trains: '12734', from: 'GNT', to: 'GNT/TPTY (Day 1)', coaches: 'SL', rest: 0 },
      { num: 40, trains: '12734,17262', from: 'GNT/TPTY (Day 2)/TPTY', to: 'TPTY/GNT (Day 1)', coaches: 'SL', rest: 0 },
      { num: 41, trains: '17262', from: 'TPTY/GNT (Day 2)', to: 'GNT', coaches: 'SL', rest: 0 },
      { num: 42, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 43, trains: '17243', from: 'GNT', to: 'GNT/VSKP (Day 1)', coaches: 'AC + SL', rest: 0 },
      { num: 44, trains: '17243,17244', from: 'GNT/VSKP (Day 2)/VSKP', to: 'VSKP/GNT (Day 1)', coaches: 'AC + SL', rest: 0 },
      { num: 45, trains: '17244,12604', from: 'VSKP/GNT (Day 2)/GNT', to: 'GNT/MAS (Day 1)', coaches: 'AC + SL / S6-S10', rest: 0 },
      { num: 46, trains: '12604,12603', from: 'GNT/MAS (Day 2)/MAS', to: 'MAS/GNT', coaches: 'S6-S10', rest: 0 },
      { num: 47, trains: '17251', from: 'GNT', to: 'GNT/DHNE (Day 1)', coaches: 'SL', rest: 0 },
      { num: 48, trains: '17251,17254', from: 'GNT/DHNE (Day 2)/DHNE', to: 'DHNE/GNT', coaches: 'SL', rest: 0 },
      { num: 49, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 50, trains: '17645,17626', from: 'GNT/RAL', to: 'RAL/SC (Day 1)', coaches: 'S1-S5', rest: 0 },
      { num: 51, trains: '17626,17625', from: 'RAL/SC (Day 2)/KCG', to: 'SC/RAL (Day 1)', coaches: 'S1-S5', rest: 0 },
      { num: 52, trains: '17625,17646', from: 'SC/RAL (Day 2)/RAL', to: 'RAL/GNT', coaches: 'S1-S5', rest: 0 },
      { num: 53, trains: 'PILOT(67230),18047', from: 'GNT/BZA', to: 'BZA/GTL (Day 1)', coaches: 'SL', rest: 0 },
      { num: 54, trains: '18047,18048', from: 'BZA/GTL (Day 2)/GTL', to: 'GTL/BZA (Day 1)', coaches: 'SL', rest: 0 },
      { num: 55, trains: '18048,PILOT(12703)', from: 'GTL/BZA (Day 2)/BZA', to: 'BZA/GNT', coaches: 'SL', rest: 0 },
      { num: 56, trains: 'REST', from: '', to: '', coaches: '', rest: 1 },
      { num: 57, trains: '17243', from: 'GNT', to: 'GNT/VSKP (Day 1)', coaches: 'SL', rest: 0 },
      { num: 58, trains: '17243,17244', from: 'GNT/VSKP (Day 2)/VSKP', to: 'VSKP/GNT (Day 1)', coaches: 'SL', rest: 0 },
      { num: 59, trains: '17244', from: 'VSKP/GNT (Day 2)', to: 'GNT', coaches: 'SL', rest: 0 },
      { num: 60, trains: 'NON DAILY LINKS', from: '', to: '', coaches: '', rest: 0 },
      { num: 61, trains: 'NON DAILY LINKS', from: '', to: '', coaches: '', rest: 0 },
      { num: 62, trains: 'NON DAILY LINKS', from: '', to: '', coaches: '', rest: 0 },
      { num: 63, trains: 'REST', from: '', to: '', coaches: '', rest: 1 }
    ];

    for (const link of sleeperLinks) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from) 
         VALUES (2, ?, ?, ?, ?, ?, ?, '2026-07-01')`,
        [link.num, link.trains, link.from, link.to, link.coaches, link.rest]
      );
    }

    // Seed TTI/Sleeper Staff (63 staff)
    const sleeperStaff = Array.from({ length: 63 }, (_, i) => ({
      name: `Employee ${i + 1}`,
      desg: 'TTI',
      pos: i + 1
    }));

    for (const person of sleeperStaff) {
      await run(
        `INSERT INTO staff (name, designation, category_id, row_position, active, join_date) 
         VALUES (?, ?, 2, ?, 1, '2026-07-01')`,
        [person.name, person.desg, person.pos]
      );
    }

    // Seed Ladies Staff Links (7 links)
    const ladiesLinks = [
      { num: 1, trains: '17261', from: 'GNT', to: '---', coaches: 'SL', rest: 0 },
      { num: 2, trains: '17261', from: '---', to: 'TPTY', coaches: 'SL', rest: 0 },
      { num: 3, trains: '12733', from: 'TPTY', to: '---', coaches: 'SL', rest: 0 },
      { num: 4, trains: '12733', from: '---', to: 'GNT', coaches: 'SL', rest: 0 },
      { num: 5, trains: '17261,17261', from: 'GNT/---', to: '---/TPTY', coaches: 'SL', rest: 0 },
      { num: 6, trains: '20630,20630', from: 'TPTY/---', to: '---/GNT', coaches: 'SL', rest: 0 },
      { num: 7, trains: 'REST', from: '', to: '', coaches: '', rest: 1 }
    ];

    for (const link of ladiesLinks) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from) 
         VALUES (3, ?, ?, ?, ?, ?, ?, '2026-07-01')`,
        [link.num, link.trains, link.from, link.to, link.coaches, link.rest]
      );
    }

    // Seed Ladies Staff (7 staff)
    const ladiesStaff = Array.from({ length: 7 }, (_, i) => ({
      name: `Employee ${i + 1}`,
      desg: 'TTI',
      pos: i + 1
    }));

    for (const person of ladiesStaff) {
      await run(
        `INSERT INTO staff (name, designation, category_id, row_position, active, join_date) 
         VALUES (?, ?, 3, ?, 1, '2026-07-01')`,
        [person.name, person.desg, person.pos]
      );
    }

    console.log('Database seeded successfully!');
  }
}

module.exports = {
  db,
  initDb,
  run,
  all,
  get
};
