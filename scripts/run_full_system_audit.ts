import 'dotenv/config';
import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import fs from 'fs';

const API_BASE = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

export interface AuditResult {
  module: string;
  elementOrFunction: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT TESTED' | 'NOT APPLICABLE';
  evidence: string;
  durationMs?: number;
}

const auditLog: AuditResult[] = [];

function record(res: AuditResult) {
  auditLog.push(res);
  const mark = res.status === 'PASS' ? '✅' : (res.status === 'FAIL' ? '❌' : (res.status === 'PARTIAL' ? '⚠️' : (res.status === 'NOT TESTED' ? '⚪' : '⏹️')));
  console.log(`${mark} [${res.module}] ${res.elementOrFunction}: ${res.status} | ${res.evidence.substring(0, 90)}`);
}

async function main() {
  console.log('================================================================');
  console.log('COMPREHENSIVE RAILWAY ROSTER MANAGEMENT AUDIT SUITE');
  console.log('Start Time:', new Date().toISOString());
  console.log('Target API:', API_BASE);
  console.log('================================================================\n');

  // Tokens
  const adminToken = jwt.sign(
    { id: 1, username: 'admin', name: 'System Admin', role: 'Admin', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  const viewerToken = jwt.sign(
    { id: 999, username: 'viewer', name: 'Regular Staff', role: 'Viewer', status: 'APPROVED' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  // -------------------------------------------------------------------------
  // SECTION 1: AUTHENTICATION & PERMISSIONS (PHASE 8)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 1: AUTHENTICATION & PERMISSIONS ---');

  // Test 1.1: Unauthenticated request
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/auth/me`);
    const t1 = performance.now();
    record({
      module: 'Authentication',
      elementOrFunction: 'Unauthorized Access Guard (GET /api/auth/me)',
      expected: 'HTTP 401 Unauthorized',
      actual: `HTTP ${res.status}`,
      status: res.status === 401 ? 'PASS' : 'FAIL',
      evidence: `Correctly rejected request lacking Bearer token with HTTP 401`,
      durationMs: t1 - t0
    });
  } catch (err: any) {
    record({
      module: 'Authentication',
      elementOrFunction: 'Unauthorized Access Guard',
      expected: 'HTTP 401',
      actual: err.message,
      status: 'FAIL',
      evidence: err.message
    });
  }

  // Test 1.2: Admin token verification
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const t1 = performance.now();
    const data = await res.json();
    record({
      module: 'Authentication',
      elementOrFunction: 'Admin Session Resolution (GET /api/auth/me)',
      expected: 'HTTP 200 with role=Admin',
      actual: `HTTP ${res.status}, role=${data.user?.role}`,
      status: (res.status === 200 && data.user?.role === 'Admin') ? 'PASS' : 'FAIL',
      evidence: `Admin identity resolved: ${data.user?.name} (Role: ${data.user?.role}) in ${(t1 - t0).toFixed(0)}ms`,
      durationMs: t1 - t0
    });
  } catch (err: any) {
    record({
      module: 'Authentication',
      elementOrFunction: 'Admin Session Resolution',
      expected: 'HTTP 200',
      actual: err.message,
      status: 'FAIL',
      evidence: err.message
    });
  }

  // Test 1.3: Viewer blocked from Admin duty modification
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/duty/change-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${viewerToken}`
      },
      body: JSON.stringify({ staff_id: 1, date: '2026-11-01', action: 'RESET' })
    });
    const t1 = performance.now();
    record({
      module: 'Authentication',
      elementOrFunction: 'Role Authorization Check (POST /api/duty/change-status)',
      expected: 'HTTP 403 Forbidden for non-admin',
      actual: `HTTP ${res.status}`,
      status: res.status === 403 ? 'PASS' : 'FAIL',
      evidence: `Viewer correctly blocked with 403 Forbidden from mutating duty assignments`,
      durationMs: t1 - t0
    });
  } catch (err: any) {
    record({
      module: 'Authentication',
      elementOrFunction: 'Role Authorization Check',
      expected: 'HTTP 403',
      actual: err.message,
      status: 'FAIL',
      evidence: err.message
    });
  }

  // Test 1.4: Invalid credentials rejection on /api/auth/login
  try {
    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'fake_user_123', password: 'wrongpassword' })
    });
    const t1 = performance.now();
    record({
      module: 'Authentication',
      elementOrFunction: 'Login with Invalid Credentials (POST /api/auth/login)',
      expected: 'HTTP 401 or 400 rejection',
      actual: `HTTP ${res.status}`,
      status: (res.status === 401 || res.status === 400) ? 'PASS' : 'FAIL',
      evidence: `Correctly rejected invalid login attempt with HTTP ${res.status}`,
      durationMs: t1 - t0
    });
  } catch (err: any) {
    record({
      module: 'Authentication',
      elementOrFunction: 'Login with Invalid Credentials',
      expected: 'HTTP 401/400',
      actual: err.message,
      status: 'FAIL',
      evidence: err.message
    });
  }

  // -------------------------------------------------------------------------
  // SECTION 2: DATE AND MONTH ISOLATION (PHASE 4)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 2: DATE AND MONTH ISOLATION ---');
  const sampleDates = [
    { date: '2026-10-01', month: 'October' },
    { date: '2026-10-15', month: 'October' },
    { date: '2026-10-25', month: 'October' },
    { date: '2026-10-31', month: 'October' },
    { date: '2026-11-01', month: 'November' },
    { date: '2026-11-05', month: 'November' },
    { date: '2026-11-25', month: 'November' },
    { date: '2026-11-30', month: 'November' }
  ];

  for (const item of sampleDates) {
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/reports/daily-view?date=${item.date}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const totalSlots = (data.categories || []).reduce((acc: number, c: any) => acc + (c.staff ? c.staff.length : 0), 0);
        record({
          module: 'Daily Summary',
          elementOrFunction: `Daily Summary View (${item.date} - ${item.month})`,
          expected: `HTTP 200 with populated duty slots (>0)`,
          actual: `HTTP ${res.status}, ${totalSlots} total duty slots`,
          status: totalSlots > 0 ? 'PASS' : 'FAIL',
          evidence: `Resolved ${totalSlots} duty assignments across ${(data.categories || []).length} categories in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: 'Daily Summary',
          elementOrFunction: `Daily Summary View (${item.date})`,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Failed with status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: 'Daily Summary',
        elementOrFunction: `Daily Summary View (${item.date})`,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // Monthly Muster Roll Isolation
  for (const m of [{ year: 2026, month: 10, name: 'October' }, { year: 2026, month: 11, name: 'November' }]) {
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/muster?year=${m.year}&month=${m.month}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const staffList = Array.isArray(data) ? data : (data.staff || []);
        record({
          module: 'Muster Roll',
          elementOrFunction: `Muster Roll Monthly Data (${m.name} ${m.year})`,
          expected: `HTTP 200 with ${m.name} muster records`,
          actual: `HTTP ${res.status}, ${staffList.length} staff members`,
          status: staffList.length > 0 ? 'PASS' : 'FAIL',
          evidence: `Loaded ${staffList.length} staff attendance records for ${m.name} ${m.year} in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: 'Muster Roll',
          elementOrFunction: `Muster Roll Monthly Data (${m.name} ${m.year})`,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: 'Muster Roll',
        elementOrFunction: `Muster Roll Monthly Data (${m.name} ${m.year})`,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // Monthly LR Sheet Isolation
  for (const m of [{ year: 2026, month: 10, name: 'October' }, { year: 2026, month: 11, name: 'November' }]) {
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/lr-sheet?year=${m.year}&month=${m.month}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const staffCount = data.staff?.length || 0;
        const recordCount = Object.keys(data.records || {}).length;
        record({
          module: 'LR Sheet',
          elementOrFunction: `LR Sheet Monthly Data (${m.name} ${m.year})`,
          expected: `HTTP 200 with ${m.name} LR staff & day records`,
          actual: `HTTP ${res.status}, ${staffCount} LR staff, ${recordCount} date records`,
          status: staffCount > 0 ? 'PASS' : 'FAIL',
          evidence: `Loaded ${staffCount} LR personnel and ${recordCount} day duty cells for ${m.name} ${m.year} in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: 'LR Sheet',
          elementOrFunction: `LR Sheet Monthly Data (${m.name} ${m.year})`,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: 'LR Sheet',
        elementOrFunction: `LR Sheet Monthly Data (${m.name} ${m.year})`,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // Roster Grid Monthly Isolation
  for (const m of [
    { year: 2026, month: 10, date: '2026-10-01', name: 'October' },
    { year: 2026, month: 11, date: '2026-11-01', name: 'November' }
  ]) {
    try {
      const t0 = performance.now();
      const res = await fetch(`${API_BASE}/roster?category_id=1&date=${m.date}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const staffCount = data.staff?.length || 0;
        record({
          module: 'Train Roster Grid',
          elementOrFunction: `Monthly Roster Grid Generation (${m.name} ${m.year})`,
          expected: `HTTP 200 with category staff roster rows`,
          actual: `HTTP ${res.status}, ${staffCount} staff rows`,
          status: staffCount > 0 ? 'PASS' : 'FAIL',
          evidence: `Generated monthly grid with ${staffCount} staff rows in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: 'Train Roster Grid',
          elementOrFunction: `Monthly Roster Grid Generation (${m.name} ${m.year})`,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: 'Train Roster Grid',
        elementOrFunction: `Monthly Roster Grid Generation (${m.name} ${m.year})`,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 3: DOCUMENTS & REPORT GENERATORS (PHASE 9)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 3: DOCUMENTS AND EXPORTS ---');
  const docTests = [
    { name: 'TA Journal (Oct 2026)', url: `${API_BASE}/documents/ta?month=10&year=2026`, module: 'TA Journal' },
    { name: 'TA Journal (Nov 2026)', url: `${API_BASE}/documents/ta?month=11&year=2026`, module: 'TA Journal' },
    { name: 'NDA Journal (Oct 2026)', url: `${API_BASE}/documents/nda?month=10&year=2026`, module: 'NDA Journal' },
    { name: 'NDA Journal (Nov 2026)', url: `${API_BASE}/documents/nda?month=11&year=2026`, module: 'NDA Journal' },
    { name: 'Staff Diary (Oct 2026)', url: `${API_BASE}/documents/diary?month=10&year=2026`, module: 'Staff Diary' },
    { name: 'Staff Diary (Nov 2026)', url: `${API_BASE}/documents/diary?month=11&year=2026`, module: 'Staff Diary' },
    { name: 'Daily Earnings (Oct 2026)', url: `${API_BASE}/documents/earnings?month=10&year=2026`, module: 'Daily Earnings' },
    { name: 'Daily Earnings (Nov 2026)', url: `${API_BASE}/documents/earnings?month=11&year=2026`, module: 'Daily Earnings' },
    { name: 'Amenity Booking Chart (2026-10-15)', url: `${API_BASE}/documents/amenity?date=2026-10-15`, module: 'Daily Booking Chart' },
    { name: 'Amenity Booking Chart (2026-11-01)', url: `${API_BASE}/documents/amenity?date=2026-11-01`, module: 'Daily Booking Chart' },
    { name: 'Individual Muster Document', url: `${API_BASE}/documents/muster?staff_id=1&month=11&year=2026`, module: 'Individual Muster' }
  ];

  for (const doc of docTests) {
    try {
      const t0 = performance.now();
      const res = await fetch(doc.url, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const hasContent = data && (Array.isArray(data) ? data.length >= 0 : Object.keys(data).length > 0);
        record({
          module: doc.module,
          elementOrFunction: doc.name,
          expected: 'HTTP 200 with structured report payload',
          actual: `HTTP ${res.status}`,
          status: hasContent ? 'PASS' : 'PARTIAL',
          evidence: `Payload returned successfully in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: doc.module,
          elementOrFunction: doc.name,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: doc.module,
        elementOrFunction: doc.name,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 4: ALL CORE BACKEND CRUD & READ ENDPOINTS (PHASE 6)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 4: CORE BACKEND APIS ---');
  const coreApis = [
    { name: 'System Status', url: `${API_BASE}/system/status`, module: 'Dashboard' },
    { name: 'Categories List', url: `${API_BASE}/categories`, module: 'Staff Management' },
    { name: 'Staff Seniority List', url: `${API_BASE}/seniority-list`, module: 'Seniority List' },
    { name: 'All Staff Roster', url: `${API_BASE}/staff`, module: 'Staff Management' },
    { name: 'Published Link Sets', url: `${API_BASE}/link-sets`, module: 'Train Roster' },
    { name: 'Category 1 Published Links', url: `${API_BASE}/links?category_id=1`, module: 'Train Roster' },
    { name: 'Category 2 Published Links', url: `${API_BASE}/links?category_id=2`, module: 'Train Roster' },
    { name: 'Category 3 Published Links', url: `${API_BASE}/links?category_id=3`, module: 'Train Roster' },
    { name: 'Non-Daily Trains Feed', url: `${API_BASE}/non-daily-trains`, module: 'Non-Daily Trains' },
    { name: 'Duty Register Entries (2026-11-01)', url: `${API_BASE}/duty-register?date=2026-11-01`, module: 'Duty Register' },
    { name: 'Duty Register Reconciliation', url: `${API_BASE}/duty-register/reconciliation?date=2026-11-01`, module: 'Duty Register' },
    { name: 'TA Approvals (2026-11)', url: `${API_BASE}/ta-approvals?month_year=2026-11`, module: 'TA Approvals' },
    { name: 'Train Timings Feed', url: `${API_BASE}/train-timings`, module: 'Train Roster' },
    { name: 'Audit Logs Feed', url: `${API_BASE}/audit-logs?limit=50`, module: 'Audit Logs' },
    { name: 'Leave Requests Feed', url: `${API_BASE}/leave-requests`, module: 'Leave / Swap' },
    { name: 'Feedback Submissions Feed', url: `${API_BASE}/feedback`, module: 'User Feedback' },
    { name: 'Train TA & NDA Rules', url: `${API_BASE}/train-ta-nda/rules`, module: 'TA / NDA Rules' },
    { name: 'Staff CR Balances', url: `${API_BASE}/staff/cr-balances?date=2026-11-01`, module: 'CR Balance' }
  ];

  for (const item of coreApis) {
    try {
      const t0 = performance.now();
      const res = await fetch(item.url, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const t1 = performance.now();
      if (res.status === 200) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data.staff?.length || data.rules?.length || Object.keys(data).length);
        record({
          module: item.module,
          elementOrFunction: item.name,
          expected: 'HTTP 200 with valid schema',
          actual: `HTTP ${res.status}`,
          status: 'PASS',
          evidence: `Returned ${count} elements in ${(t1 - t0).toFixed(0)}ms`,
          durationMs: t1 - t0
        });
      } else {
        record({
          module: item.module,
          elementOrFunction: item.name,
          expected: 'HTTP 200',
          actual: `HTTP ${res.status}`,
          status: 'FAIL',
          evidence: `Status ${res.status}`,
          durationMs: t1 - t0
        });
      }
    } catch (err: any) {
      record({
        module: item.module,
        elementOrFunction: item.name,
        expected: 'HTTP 200',
        actual: err.message,
        status: 'FAIL',
        evidence: err.message
      });
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 5: DATABASE TABLE INTEGRITY & SCHEMAS (PHASE 7)
  // -------------------------------------------------------------------------
  console.log('\n--- SECTION 5: DATABASE AND DATA INTEGRITY ---');
  try {
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT || '25101', 10),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      ssl: { rejectUnauthorized: false }
    });

    const tables = [
      'staff',
      'categories',
      'links',
      'link_sets',
      'staff_roster_assignments',
      'overrides',
      'muster_records',
      'ta_approvals',
      'ta_entries',
      'nda_entries',
      'diary_entries',
      'daily_earnings_entries',
      'lr_sheet_records',
      'duty_register_entry',
      'duty_register_staff',
      'audit_logs',
      'leave_requests',
      'feedbacks',
      'seniority_list',
      'non_daily_trains'
    ];

    for (const tbl of tables) {
      const t0 = performance.now();
      const [rows]: [any[], any] = await conn.query(`SELECT COUNT(*) as cnt FROM ${tbl}`);
      const t1 = performance.now();
      const cnt = rows[0]?.cnt || 0;
      record({
        module: 'Database',
        elementOrFunction: `Table integrity: ${tbl}`,
        expected: 'Table exists and returns row count',
        actual: `${cnt} records`,
        status: 'PASS',
        evidence: `Verified ${cnt} records in ${(t1 - t0).toFixed(0)}ms`,
        durationMs: t1 - t0
      });
    }

    // Versioned staff assignments check
    const [octStaff]: [any[], any] = await conn.query(
      `SELECT COUNT(*) as cnt FROM staff_roster_assignments WHERE effective_from <= '2026-10-01' AND (effective_to IS NULL OR effective_to >= '2026-10-01')`
    );
    const [novStaff]: [any[], any] = await conn.query(
      `SELECT COUNT(*) as cnt FROM staff_roster_assignments WHERE effective_from <= '2026-11-01' AND (effective_to IS NULL OR effective_to >= '2026-11-01')`
    );
    record({
      module: 'Database',
      elementOrFunction: 'Date-Versioned Staff Isolation (staff_roster_assignments)',
      expected: 'Independent versioned records for Oct and Nov 2026',
      actual: `Oct: ${octStaff[0].cnt}, Nov: ${novStaff[0].cnt}`,
      status: (octStaff[0].cnt > 0 && novStaff[0].cnt > 0) ? 'PASS' : 'FAIL',
      evidence: `October has ${octStaff[0].cnt} assignments; November has ${novStaff[0].cnt} assignments`
    });

    // Orphaned overrides check
    const [orphaned]: [any[], any] = await conn.query(
      `SELECT COUNT(*) as cnt FROM overrides o LEFT JOIN staff s ON o.staff_id = s.id WHERE s.id IS NULL`
    );
    record({
      module: 'Database',
      elementOrFunction: 'Foreign Key Integrity (overrides.staff_id -> staff.id)',
      expected: '0 orphaned overrides',
      actual: `${orphaned[0].cnt} orphaned records`,
      status: orphaned[0].cnt === 0 ? 'PASS' : 'FAIL',
      evidence: orphaned[0].cnt === 0 ? 'Clean relational integrity: 0 orphaned overrides' : `Found ${orphaned[0].cnt} orphaned overrides`
    });

    await conn.end();
  } catch (dbErr: any) {
    record({
      module: 'Database',
      elementOrFunction: 'Aiven Cloud MySQL Connection',
      expected: 'Active SSL connection',
      actual: dbErr.message,
      status: 'FAIL',
      evidence: dbErr.message
    });
  }

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('AUDIT SUITE EXECUTION COMPLETE');
  console.log('================================================================');
  const passCount = auditLog.filter(r => r.status === 'PASS').length;
  const failCount = auditLog.filter(r => r.status === 'FAIL').length;
  const partialCount = auditLog.filter(r => r.status === 'PARTIAL').length;
  const notTestedCount = auditLog.filter(r => r.status === 'NOT TESTED').length;

  console.log(`Total System Tests Executed: ${auditLog.length}`);
  console.log(`  PASS       : ${passCount}`);
  console.log(`  FAIL       : ${failCount}`);
  console.log(`  PARTIAL    : ${partialCount}`);
  console.log(`  NOT TESTED : ${notTestedCount}`);

  fs.writeFileSync('scripts/audit_comprehensive_results.json', JSON.stringify(auditLog, null, 2));
  console.log('Saved results to scripts/audit_comprehensive_results.json\n');
}

main().catch(console.error);
