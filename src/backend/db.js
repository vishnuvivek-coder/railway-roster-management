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
      rest_day TEXT,
      join_date TEXT,
      leave_date TEXT,
      UNIQUE(category_id, row_position)
    )
  `);

  try {
    await run(`ALTER TABLE staff ADD COLUMN rest_day TEXT`);
  } catch (e) {
    // Ignore if column already exists
  }

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
      from_date TEXT,
      to_date TEXT,
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
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      undo_data TEXT,
      is_undone INTEGER DEFAULT 0
    )
  `);

  try {
    await run(`ALTER TABLE audit_logs ADD COLUMN undo_data TEXT`);
  } catch (e) {
    // Ignore if column already exists
  }

  try {
    await run(`ALTER TABLE audit_logs ADD COLUMN is_undone INTEGER DEFAULT 0`);
  } catch (e) {
    // Ignore if column already exists
  }

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

  await run(`
    CREATE TABLE IF NOT EXISTS ta_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      month_year TEXT NOT NULL, -- e.g. '2026-08'
      duty_date TEXT,           -- e.g. '2026-08-01'
      date_str TEXT NOT NULL,   -- e.g. '1/8/26'
      train_no TEXT,
      from_station TEXT,
      to_station TEXT,
      dep_time TEXT,
      arr_time TEXT,
      ta_a1 TEXT,
      ta_a TEXT,
      ta_b1 TEXT,
      days_claiming_ta REAL,
      object_of_journey TEXT DEFAULT 'MANNING AC COACHES',
      remarks TEXT,
      row_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS nda_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      month_year TEXT NOT NULL, -- e.g. '2026-08'
      date_str TEXT NOT NULL,   -- e.g. '1/8/26'
      train_no TEXT,
      sched_dep TEXT,
      sched_arr TEXT,
      act_dep TEXT,
      act_arr TEXT,
      from_station TEXT,
      to_station TEXT,
      night_hours REAL,
      row_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      month_year TEXT NOT NULL, -- e.g. '2026-06'
      date_str TEXT NOT NULL,   -- e.g. '3/6/26'
      train_no TEXT,
      dep_time TEXT,
      arr_time TEXT,
      from_station TEXT,
      to_station TEXT,
      eft_from TEXT,
      eft_to TEXT,
      total_issued INTEGER,
      no_of_cases INTEGER,
      collected_rs REAL,
      gst_cases INTEGER,
      gst_amount REAL,
      total_amount REAL,
      remit_station TEXT,
      remit_mr_no TEXT,
      remit_date TEXT,
      remit_amount REAL,
      row_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS actual_train_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      train_no TEXT NOT NULL,
      run_date TEXT NOT NULL,
      station_code TEXT NOT NULL,
      sched_arr TEXT,
      sched_dep TEXT,
      act_arr TEXT,
      act_dep TEXT,
      delay_arr_mins INTEGER DEFAULT 0,
      delay_dep_mins INTEGER DEFAULT 0,
      source TEXT DEFAULT 'NTES',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(train_no, run_date, station_code)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS muster_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      code TEXT NOT NULL,
      remarks TEXT,
      updated_by TEXT DEFAULT 'Admin',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS daily_earnings_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
      staff_name TEXT NOT NULL,
      designation TEXT DEFAULT 'TTI',
      depot_title TEXT DEFAULT 'GNT ATY-1D2',
      twt_nc INTEGER DEFAULT 0,
      twt_fare REAL DEFAULT 0,
      twt_penalty REAL DEFAULT 0,
      ir_nc INTEGER DEFAULT 0,
      ir_fare REAL DEFAULT 0,
      ir_penalty REAL DEFAULT 0,
      ubl_nc INTEGER DEFAULT 0,
      ubl_amt REAL DEFAULT 0,
      gst REAL DEFAULT 0,
      z652_nc INTEGER DEFAULT 0,
      z652_amt REAL DEFAULT 0,
      oc_nc INTEGER DEFAULT 0,
      oc_amt REAL DEFAULT 0,
      duty TEXT,
      remarks TEXT,
      row_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, staff_id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS lr_duty_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      last_train_no TEXT,
      from_station TEXT DEFAULT '---',
      to_station TEXT DEFAULT 'GNT',
      arrival_date TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      rest_hours_required INTEGER DEFAULT 12,
      notes TEXT,
      updated_by TEXT DEFAULT 'Admin',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, arrival_date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS lr_sheet_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      duty_code TEXT NOT NULL,
      remarks TEXT,
      updated_by TEXT DEFAULT 'Admin',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, date)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS ta_approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      month_year TEXT NOT NULL,
      duty_date TEXT NOT NULL,
      date_str TEXT NOT NULL,
      link_number INTEGER,
      train_no TEXT,
      from_station TEXT,
      to_station TEXT,
      dep_time TEXT,
      arr_time TEXT,
      absence_hours REAL,
      ta_percentage REAL,
      da_rate REAL DEFAULT 800,
      claim_amount REAL,
      status TEXT DEFAULT 'PENDING',
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      object_of_journey TEXT DEFAULT 'MANNING AC COACHES',
      remarks TEXT,
      row_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(staff_id, duty_date, train_no, from_station, to_station)
    )
  `);

  const staffAddCols = [
    `ALTER TABLE staff ADD COLUMN pf_no TEXT DEFAULT '07323475'`,
    `ALTER TABLE staff ADD COLUMN bill_unit TEXT DEFAULT '0910629'`,
    `ALTER TABLE staff ADD COLUMN pay_amount INTEGER DEFAULT 68000`,
    `ALTER TABLE staff ADD COLUMN doa TEXT DEFAULT '05/08/2000'`,
    `ALTER TABLE staff ADD COLUMN hq_station TEXT DEFAULT 'GNT'`,
    `ALTER TABLE staff ADD COLUMN t_code_no TEXT DEFAULT '7133'`
  ];

  for (const alterSql of staffAddCols) {
    try {
      await run(alterSql);
    } catch (e) {
      // Column may already exist
    }
  }

  const overrideAddCols = [
    `ALTER TABLE overrides ADD COLUMN status TEXT DEFAULT 'DUTY'`,
    `ALTER TABLE overrides ADD COLUMN substitute_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL`,
    `ALTER TABLE overrides ADD COLUMN substitute_name TEXT`,
    `ALTER TABLE overrides ADD COLUMN leave_type TEXT`,
    `ALTER TABLE overrides ADD COLUMN advance_train_no TEXT`,
    `ALTER TABLE overrides ADD COLUMN is_advance_duty INTEGER DEFAULT 0`,
    `ALTER TABLE overrides ADD COLUMN target_category_id INTEGER`,
    `ALTER TABLE overrides ADD COLUMN shifted_place TEXT`,
    `ALTER TABLE overrides ADD COLUMN extra_train_no TEXT`,
    `ALTER TABLE overrides ADD COLUMN is_extra INTEGER DEFAULT 0`,
    `ALTER TABLE overrides ADD COLUMN shifted_from_link INTEGER`,
    `ALTER TABLE overrides ADD COLUMN shifted_from_train TEXT`
  ];

  for (const alterSql of overrideAddCols) {
    try {
      await run(alterSql);
    } catch (e) {
      // Column may already exist
    }
  }

  try {
    await run(`ALTER TABLE ta_entries ADD COLUMN duty_date TEXT`);
  } catch (e) {
    // Column already exists
  }

  try {
    const nullRows = await all('SELECT id, month_year, date_str FROM ta_entries WHERE duty_date IS NULL');
    for (const row of nullRows) {
      if (row.month_year && row.date_str) {
        const parts = row.date_str.split('/');
        if (parts.length >= 2) {
          const day = parts[0].padStart(2, '0');
          const [yearStr, monthStr] = row.month_year.split('-');
          const iso = `${yearStr}-${monthStr}-${day}`;
          await run('UPDATE ta_entries SET duty_date = ? WHERE id = ?', [iso, row.id]);
        }
      }
    }
  } catch (e) {
    // Ignore migration backfill error
  }

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
    const corStaff = [
      {
            "pos": 1,
            "name": "SK SALEEM",
            "desg": "TTI"
      },
      {
            "pos": 2,
            "name": "BRK REDDY",
            "desg": "CTI"
      },
      {
            "pos": 3,
            "name": "M KESHAVULU",
            "desg": "CTI"
      },
      {
            "pos": 4,
            "name": "S NAGALINGAPPA",
            "desg": "CTI"
      },
      {
            "pos": 5,
            "name": "VV PAVAN KUMAR",
            "desg": "CTI"
      },
      {
            "pos": 6,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 7,
            "name": "BV RAO",
            "desg": "CTI"
      },
      {
            "pos": 8,
            "name": "R BANGARAIAH",
            "desg": "TTI"
      },
      {
            "pos": 9,
            "name": "PRM ALI KHAN",
            "desg": "CTI"
      },
      {
            "pos": 10,
            "name": "VAN REDDY",
            "desg": "CTI"
      },
      {
            "pos": 11,
            "name": "MN RAO",
            "desg": "CTI"
      },
      {
            "pos": 12,
            "name": "KAKI SRINIVASA RAO",
            "desg": "CTI"
      },
      {
            "pos": 13,
            "name": "K RAMANAIAH",
            "desg": "CTI"
      },
      {
            "pos": 14,
            "name": "I DASARADHI",
            "desg": "CTI"
      },
      {
            "pos": 15,
            "name": "BP RAJA KUMAR",
            "desg": "CTI"
      },
      {
            "pos": 16,
            "name": "TRS REDDY",
            "desg": "CTI"
      },
      {
            "pos": 17,
            "name": "KRM REDDY",
            "desg": "CTI"
      },
      {
            "pos": 18,
            "name": "CH RAMESH BABU",
            "desg": "TTI"
      },
      {
            "pos": 19,
            "name": "M SRINIVASULU",
            "desg": "CTI"
      },
      {
            "pos": 20,
            "name": "S PRAKASA RAO",
            "desg": "CTI"
      },
      {
            "pos": 21,
            "name": "KV RAMANA RAO",
            "desg": "CTI"
      }
];

    for (const link of sleeperLinks) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from) 
         VALUES (2, ?, ?, ?, ?, ?, ?, '2026-07-01')`,
        [link.num, link.trains, link.from, link.to, link.coaches, link.rest]
      );
    }

        // Seed TTI/Sleeper Staff (63 staff)
    const sleeperStaff = [
      {
            "pos": 1,
            "name": "P GOPALA RAO",
            "desg": "SRCCTC"
      },
      {
            "pos": 2,
            "name": "K KOTI REDDY",
            "desg": "TTI"
      },
      {
            "pos": 3,
            "name": "PV SUBBA RAO",
            "desg": "TTI"
      },
      {
            "pos": 4,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 5,
            "name": "LP KUMAR",
            "desg": "CTI"
      },
      {
            "pos": 6,
            "name": "K NARESH",
            "desg": "TTI"
      },
      {
            "pos": 7,
            "name": "D VANIL KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 8,
            "name": "K KUSHWANTH SINGH",
            "desg": "SRCCTC"
      },
      {
            "pos": 9,
            "name": "N KISHAN KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 10,
            "name": "Y MURALI KRISHNA",
            "desg": "TTI"
      },
      {
            "pos": 11,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 12,
            "name": "T SRIHARSHA",
            "desg": "TTI"
      },
      {
            "pos": 13,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 14,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 15,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 16,
            "name": "B RAJA KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 17,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 18,
            "name": "K GOPI",
            "desg": "SRCCTC"
      },
      {
            "pos": 19,
            "name": "P KRISHNA MOHAN",
            "desg": "TTI"
      },
      {
            "pos": 20,
            "name": "D ANVESH",
            "desg": "TTI"
      },
      {
            "pos": 21,
            "name": "Y KORNEL BABU",
            "desg": "TTI"
      },
      {
            "pos": 22,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 23,
            "name": "G VARADARAJULU",
            "desg": "TTI"
      },
      {
            "pos": 24,
            "name": "S SUBRAHMANYAM",
            "desg": "TTI"
      },
      {
            "pos": 25,
            "name": "D KHADER BASH",
            "desg": "SRTE"
      },
      {
            "pos": 26,
            "name": "A VENKI REDDY",
            "desg": "TTI"
      },
      {
            "pos": 27,
            "name": "P RAVI KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 28,
            "name": "O ANIL",
            "desg": "TTI"
      },
      {
            "pos": 29,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 30,
            "name": "SK JHA",
            "desg": "TTI"
      },
      {
            "pos": 31,
            "name": "SH MADHU BABU",
            "desg": "TTI"
      },
      {
            "pos": 32,
            "name": "K KRANTHI KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 33,
            "name": "SVSR KRISHNA",
            "desg": "TTI"
      },
      {
            "pos": 34,
            "name": "J VINAY KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 35,
            "name": "BVS REDDY",
            "desg": "TTI"
      },
      {
            "pos": 36,
            "name": "RNR NAIK",
            "desg": "SRCCTC"
      },
      {
            "pos": 37,
            "name": "NRC REDDY",
            "desg": "TTI"
      },
      {
            "pos": 38,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 39,
            "name": "P BALA KRISHNA",
            "desg": "TTI"
      },
      {
            "pos": 40,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 41,
            "name": "SK KHASIM",
            "desg": "TTI"
      },
      {
            "pos": 42,
            "name": "K DURGA RAO",
            "desg": "SRTE"
      },
      {
            "pos": 43,
            "name": "SK KARIMULLAH",
            "desg": "TTI"
      },
      {
            "pos": 44,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 45,
            "name": "KV SURESH",
            "desg": "TTI"
      },
      {
            "pos": 46,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 47,
            "name": "M NAGARAJU",
            "desg": "TTI"
      },
      {
            "pos": 48,
            "name": "U RAMA KRISHNA",
            "desg": "TTI"
      },
      {
            "pos": 49,
            "name": "M SURESH",
            "desg": "TTI"
      },
      {
            "pos": 50,
            "name": "U BALA JOJI",
            "desg": "SRCCTC"
      },
      {
            "pos": 51,
            "name": "B PAVAN KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 52,
            "name": "SUVVADA SRINU",
            "desg": "SRCCTC"
      },
      {
            "pos": 53,
            "name": "N VENKATESH",
            "desg": "TTI"
      },
      {
            "pos": 54,
            "name": "T SIVA KUMAR",
            "desg": "TTI"
      },
      {
            "pos": 55,
            "name": "KVB SANKAR",
            "desg": "TTI"
      },
      {
            "pos": 56,
            "name": "M VENKATESWARLU",
            "desg": "TTI"
      },
      {
            "pos": 57,
            "name": "SK MASTAN BASHA",
            "desg": "SRTE"
      },
      {
            "pos": 58,
            "name": "B SURESH",
            "desg": "TTI"
      },
      {
            "pos": 59,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 60,
            "name": "VACANT (V)",
            "desg": ""
      },
      {
            "pos": 61,
            "name": "N SWARNA BABU",
            "desg": "TTI"
      },
      {
            "pos": 62,
            "name": "Y SRIKANTH",
            "desg": "TTI"
      },
      {
            "pos": 63,
            "name": "VACANT (V)",
            "desg": ""
      }
];

    for (const link of ladiesLinks) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from) 
         VALUES (3, ?, ?, ?, ?, ?, ?, '2026-07-01')`,
        [link.num, link.trains, link.from, link.to, link.coaches, link.rest]
      );
    }

    // Seed Ladies Staff (7 staff)
    const ladiesNames = [
      "VS CHANDRIKA", "V UMADEVI", "EV RAMANAMMA", "B KEJIA KUMARI", "SD SHAHEDA", "K SIVA PARVATHI", "M SIVA KUMARI"
    ];
    const ladiesStaff = ladiesNames.map((name, i) => ({
      name,
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

  // Ensure Category 4: Leave Reserve (LR) Staff exists
  const lrCat = await get("SELECT * FROM categories WHERE id = 4 OR code = 'LR_STAFF'");
  if (!lrCat) {
    await run(
      `INSERT INTO categories (id, name, code, cycle_length, anchor_date)
       VALUES (4, 'Leave Reserve (LR) Staff', 'LR_STAFF', 23, '2026-08-01')`
    );
  }

  // Seed / Sync LR Staff list (23 staff members with accurate Rest Days)
  const lrStaffSeed = [
    { pos: 1, name: 'CH SRINIVASA RAO', desg: 'CTI', rest: 'SUN' },
    { pos: 2, name: 'AG KRISHNA', desg: 'Sr.CCTC', rest: 'TUE' },
    { pos: 3, name: 'D RAKESH', desg: 'Sr.CCTC', rest: 'FRI' },
    { pos: 4, name: 'G SHIVAN', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 5, name: 'MVS NAGI REDDY', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 6, name: 'B VENKAT REDDY', desg: 'Sr.CCTC', rest: 'TUE' },
    { pos: 7, name: 'MSA RAJU', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 8, name: 'KB RAO', desg: 'Sr.CCTC', rest: 'FRI' },
    { pos: 9, name: 'SANJAY KUMAR', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 10, name: 'NC MEENA', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 11, name: 'T KANTHA RAO', desg: 'Sr.CCTC', rest: 'TUE' },
    { pos: 12, name: 'BR MEENA', desg: 'Sr.CCTC', rest: 'WED' },
    { pos: 13, name: 'T ANKAMMA RAO', desg: 'Sr.CCTC', rest: 'MON' },
    { pos: 14, name: 'MV RAMA REDDY', desg: 'Sr.CCTC', rest: 'FRI' },
    { pos: 15, name: 'MV ANJANEYULU', desg: 'Sr.CCTC', rest: 'FRI' },
    { pos: 16, name: 'SV SIVA KUMAR', desg: 'CCTC', rest: 'SUN' },
    { pos: 17, name: 'ELN RAO', desg: 'CCTC', rest: 'MON' },
    { pos: 18, name: 'V SRINIVASA RAO', desg: 'CCTC', rest: 'THU' },
    { pos: 19, name: 'K NAGA NAIK', desg: 'CCTC', rest: 'TUE' },
    { pos: 20, name: 'B P SINGH', desg: 'CCTC', rest: 'WED' },
    { pos: 21, name: 'R SAIDA NAIK', desg: 'CCTC', rest: 'SAT' },
    { pos: 22, name: 'S HYMA TULASI', desg: 'Sr.CCTC', rest: 'THU' },
    { pos: 23, name: 'V.A. CHAKRAVARTHY', desg: 'CCTC', rest: '-' }
  ];

  for (const s of lrStaffSeed) {
    const existing = await get('SELECT * FROM staff WHERE category_id = 4 AND row_position = ?', [s.pos]);
    if (!existing) {
      await run(
        `INSERT INTO staff (name, designation, category_id, row_position, active, rest_day, join_date)
         VALUES (?, ?, 4, ?, 1, ?, '2026-07-01')`,
        [s.name, s.desg, s.pos, s.rest]
      );
    } else {
      await run(
        `UPDATE staff SET name = ?, designation = ?, rest_day = ? WHERE category_id = 4 AND row_position = ?`,
        [s.name, s.desg, s.rest, s.pos]
      );
    }

    const existingLink = await get('SELECT * FROM links WHERE category_id = 4 AND link_number = ?', [s.pos]);
    if (!existingLink) {
      await run(
        `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_name, set_type)
         VALUES (4, ?, ?, 'GNT', 'GNT', 'Relief / LR', 0, '2026-07-01', ?, 'Relief / LR')`,
        [s.pos, `LR-${s.pos} (${s.rest} Rest)`, `LR Link ${s.pos}`]
      );
    }
  }

  // Create Non-Daily Trains table
  await run(`
    CREATE TABLE IF NOT EXISTS non_daily_trains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL, -- 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'
      train_number TEXT NOT NULL,
      departure_station TEXT,
      departure_time TEXT,
      arrival_station TEXT,
      arrival_time TEXT,
      coaches TEXT DEFAULT 'SL / AC',
      remarks TEXT,
      assigned_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
      assigned_staff_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed Non-Daily Trains if empty
  const nonDailyCount = await get('SELECT COUNT(*) as count FROM non_daily_trains');
  if (nonDailyCount.count === 0) {
    const nonDailyTrainsSeed = [
      // SUNDAY (7)
      { day: 'SUNDAY', train: '07029', dep_stn: 'BZA', dep_time: '11:05', arr_stn: 'CHZ', arr_time: '12:40', remarks: '' },
      { day: 'SUNDAY', train: '17231', dep_stn: 'BZA', dep_time: '13:50', arr_stn: 'CHZ', arr_time: '20:40', remarks: '' },
      { day: 'SUNDAY', train: '17232', dep_stn: 'CHZ', dep_time: '23:40', arr_stn: 'BZA', arr_time: '06:25', remarks: 'Returns MON' },
      { day: 'SUNDAY', train: '02811', dep_stn: 'GNT', dep_time: '08:30', arr_stn: 'DMM', arr_time: '21:00', remarks: '' },
      { day: 'SUNDAY', train: '02812', dep_stn: 'DMM', dep_time: '08:30', arr_stn: 'BZA', arr_time: '18:00', remarks: 'Returns MON' },
      { day: 'SUNDAY', train: '17425', dep_stn: 'GNT', dep_time: '10:40', arr_stn: 'SC', arr_time: '16:00', remarks: '' },
      { day: 'SUNDAY', train: '17625', dep_stn: 'KCG', dep_time: '22:20', arr_stn: 'RAL', arr_time: '06:25', remarks: '' },

      // MONDAY (6)
      { day: 'MONDAY', train: '07609', dep_stn: 'GNT', dep_time: '02:55', arr_stn: 'RU', arr_time: '09:30', remarks: 'Runs TUE' },
      { day: 'MONDAY', train: '07610', dep_stn: 'RU', dep_time: '13:35', arr_stn: 'GNT', arr_time: '10:00', remarks: 'Runs TUE' },
      { day: 'MONDAY', train: '17646', dep_stn: 'GNT', dep_time: '08:50', arr_stn: 'SC', arr_time: '16:00', remarks: '' },
      { day: 'MONDAY', train: '17426', dep_stn: 'SC', dep_time: '11:40', arr_stn: 'GNT', arr_time: '17:10', remarks: 'Returns TUE' },
      { day: 'MONDAY', train: '07032', dep_stn: 'GNT', dep_time: '00:10', arr_stn: 'TPTY', arr_time: '10:30', remarks: '' },
      { day: 'MONDAY', train: '07194', dep_stn: 'TPTY', dep_time: '03:15', arr_stn: 'GNT', arr_time: '10:40', remarks: '' },

      // TUESDAY (4)
      { day: 'TUESDAY', train: '07615', dep_stn: 'GNT', dep_time: '23:10', arr_stn: 'RU', arr_time: '08:10', remarks: '' },
      { day: 'TUESDAY', train: '07616', dep_stn: 'RU', dep_time: '07:30', arr_stn: 'GNT', arr_time: '15:05', remarks: 'Returns WED' },
      { day: 'TUESDAY', train: '17041', dep_stn: 'GNT', dep_time: '12:20', arr_stn: 'RU', arr_time: '19:20', remarks: '' },
      { day: 'TUESDAY', train: '17042', dep_stn: 'RU', dep_time: '10:40', arr_stn: 'GNT', arr_time: '17:40', remarks: 'Returns WED' },

      // WEDNESDAY (6)
      { day: 'WEDNESDAY', train: '22882', dep_stn: 'GNT', dep_time: '10:35', arr_stn: 'WADI', arr_time: '21:10', remarks: '' },
      { day: 'WEDNESDAY', train: '22881', dep_stn: 'WADI', dep_time: '16:55', arr_stn: 'GNT', arr_time: '02:05', remarks: 'Returns THU' },
      { day: 'WEDNESDAY', train: '17221', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'WADI', arr_time: '00:05', remarks: '' },
      { day: 'WEDNESDAY', train: '17222', dep_stn: 'WADI', dep_time: '23:00', arr_stn: 'GNT', arr_time: '08:15', remarks: 'Returns THU' },
      { day: 'WEDNESDAY', train: '17069', dep_stn: 'GNT', dep_time: '22:40', arr_stn: 'RU', arr_time: '07:15', remarks: '' },
      { day: 'WEDNESDAY', train: '17262', dep_stn: 'TPTY', dep_time: '19:25', arr_stn: 'GNT', arr_time: '07:20', remarks: '' },

      // THURSDAY (6)
      { day: 'THURSDAY', train: '12755', dep_stn: 'BZA', dep_time: '08:40', arr_stn: 'SC', arr_time: '02:40', remarks: '' },
      { day: 'THURSDAY', train: '17625', dep_stn: 'KCG', dep_time: '22:20', arr_stn: 'RAL', arr_time: '06:25', remarks: '' },
      { day: 'THURSDAY', train: '12604', dep_stn: 'GNT', dep_time: '22:00', arr_stn: 'MAS', arr_time: '05:40', remarks: '' },
      { day: 'THURSDAY', train: '16357', dep_stn: 'MS', dep_time: '13:00', arr_stn: 'GNT', arr_time: '21:10', remarks: '' },
      { day: 'THURSDAY', train: '17261', dep_stn: 'GNT', dep_time: '16:30', arr_stn: 'TPTY', arr_time: '03:50', remarks: '' },
      { day: 'THURSDAY', train: '17070', dep_stn: 'RU', dep_time: '22:40', arr_stn: 'GNT', arr_time: '05:15', remarks: '' },

      // FRIDAY (4)
      { day: 'FRIDAY', train: '17231', dep_stn: 'BZA', dep_time: '13:50', arr_stn: 'CHZ', arr_time: '20:40', remarks: '' },
      { day: 'FRIDAY', train: '17232', dep_stn: 'CHZ', dep_time: '23:40', arr_stn: 'BZA', arr_time: '06:25', remarks: '' },
      { day: 'FRIDAY', train: '18063', dep_stn: 'GNT', dep_time: '09:45', arr_stn: 'DMM', arr_time: '20:30', remarks: '' },
      { day: 'FRIDAY', train: '18064', dep_stn: 'DMM', dep_time: '08:15', arr_stn: 'GNT', arr_time: '19:25', remarks: '' },

      // SATURDAY (8)
      { day: 'SATURDAY', train: '17221', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'WADI', arr_time: '00:05', remarks: '' },
      { day: 'SATURDAY', train: '17222', dep_stn: 'WADI', dep_time: '23:00', arr_stn: 'GNT', arr_time: '08:15', remarks: '' },
      { day: 'SATURDAY', train: '17221', dep_stn: 'GNT', dep_time: '13:35', arr_stn: 'SC', arr_time: '00:05', remarks: '' },
      { day: 'SATURDAY', train: '12756', dep_stn: 'SC', dep_time: '06:40', arr_stn: 'BZA', arr_time: '12:50', remarks: '' },
      { day: 'SATURDAY', train: '07193', dep_stn: 'GNT', dep_time: '05:30', arr_stn: 'KPD', arr_time: '16:30', remarks: 'Runs SUN' },
      { day: 'SATURDAY', train: '07194', dep_stn: 'KPD', dep_time: '01:00', arr_stn: 'GNT', arr_time: '10:40', remarks: 'Runs TUE' },
      { day: 'SATURDAY', train: '16358', dep_stn: 'GNT', dep_time: '14:00', arr_stn: 'MS', arr_time: '22:55', remarks: '' },
      { day: 'SATURDAY', train: '12603', dep_stn: 'MAS', dep_time: '16:45', arr_stn: 'GNT', arr_time: '23:25', remarks: '' }
    ];

    for (const t of nonDailyTrainsSeed) {
      await run(
        `INSERT INTO non_daily_trains (day_of_week, train_number, departure_station, departure_time, arrival_station, arrival_time, coaches, remarks)
         VALUES (?, ?, ?, ?, ?, ?, 'SL / AC', ?)`,
        [t.day, t.train, t.dep_stn, t.dep_time, t.arr_stn, t.arr_time, t.remarks || null]
      );
    }
  }
}

module.exports = {
  db,
  initDb,
  run,
  all,
  get
};
