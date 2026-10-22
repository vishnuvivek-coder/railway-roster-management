import fs from 'fs';
import path from 'path';
import { get, all, run } from '../db';
import { ApiError } from '../utils/api_error';
import { ENDPOINT_GROUPS, FLAT_ENDPOINTS } from '../endpoint_registry';
import { logAudit } from './audit.service';

export async function getDataFlowMap() {
  return {
    success: true,
    title: 'Railway Roster Manager — Complete Backend & Frontend Data-Flow Map',
    total_groups: ENDPOINT_GROUPS.length,
    total_endpoints: FLAT_ENDPOINTS.length,
    groups: ENDPOINT_GROUPS
  };
}

export function getDbFilePath() {
  const dbFile = path.resolve(__dirname, '../roster.db');
  if (fs.existsSync(dbFile)) return dbFile;
  const rootDb = path.resolve(process.cwd(), 'roster.db');
  if (fs.existsSync(rootDb)) return rootDb;
  const srcDb = path.resolve(__dirname, '../../roster.db');
  if (fs.existsSync(srcDb)) return srcDb;
  return dbFile;
}

export async function jsonExport() {
  const tables = [
    'categories', 'staff', 'links', 'overrides', 'leave_requests',
    'muster_records', 'ta_entries', 'nda_entries', 'diary_entries',
    'daily_earnings_entries', 'ta_approvals', 'lr_sheet_records', 'lr_duty_completions'
  ];
  const data: any = {
    version: 1,
    exported_at: new Date().toISOString(),
    tables: {}
  };
  for (const t of tables) {
    try {
      data.tables[t] = await all(`SELECT * FROM ${t}`);
    } catch (err) {
      data.tables[t] = [];
    }
  }
  return data;
}

export async function jsonImport(tables: Record<string, any[]>) {
  if (!tables || typeof tables !== 'object') {
    throw new ApiError(400, 'Invalid backup format. "tables" object required.');
  }

  await run('BEGIN TRANSACTION');
  try {
    for (const [tableName, rows] of Object.entries(tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const tblExists = await get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
      if (!tblExists) continue;

      await run(`DELETE FROM ${tableName}`);

      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(', ');
      const insertSql = `INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = cols.map(c => row[c]);
        await run(insertSql, values);
      }
    }
    await run('COMMIT');
    return { success: true, message: 'Database restored successfully from backup!' };
  } catch (txErr) {
    await run('ROLLBACK');
    throw txErr;
  }
}

export async function submitFeedback(data: any, currentUser: any) {
  const { category, subject, message, rating, contact_info, user_name } = data;
  if (!subject || !message) {
    throw new ApiError(400, 'Subject and message are required');
  }

  const userId = currentUser ? currentUser.id : null;
  const authorName = user_name || (currentUser ? (currentUser.name || currentUser.username) : 'Anonymous Staff');
  const userRole = currentUser ? currentUser.role : 'Staff';
  const cleanCategory = category || 'General';
  const numRating = parseInt(rating, 10) || 5;

  const result = await run(`
    INSERT INTO feedbacks (user_id, user_name, role, category, subject, message, rating, contact_info, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')
  `, [userId, authorName, userRole, cleanCategory, subject.trim(), message.trim(), numRating, contact_info || null]);

  await logAudit(
    userRole,
    'SUBMIT_FEEDBACK',
    `Feedback submitted by '${authorName}' [${cleanCategory}]: ${subject.trim()}`
  );

  return {
    success: true,
    message: 'Thank you! Your feedback has been received and logged for administration review.',
    feedbackId: (result as any).lastID
  };
}

export async function getFeedbacks(query: any) {
  const { status, category } = query;
  let sql = 'SELECT * FROM feedbacks WHERE 1=1';
  const params: any[] = [];

  if (status && status !== 'ALL') {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (category && category !== 'ALL') {
    sql += ' AND category = ?';
    params.push(category);
  }
  sql += ' ORDER BY created_at DESC LIMIT 100';

  const rows = await all(sql, params);
  return { success: true, feedbacks: rows };
}

export async function updateFeedbackStatus(id: any, data: any, currentUser: any = 'Admin') {
  const { status, admin_response } = data;
  if (!status) {
    throw new ApiError(400, 'status is required');
  }

  const existing = await get('SELECT * FROM feedbacks WHERE id = ?', [id]);
  if (!existing) {
    throw new ApiError(404, 'Feedback entry not found');
  }

  await run(`
    UPDATE feedbacks 
    SET status = ?, admin_response = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [status, admin_response || existing.admin_response, id]);

  await logAudit(
    'Admin',
    'RESOLVE_FEEDBACK',
    `Feedback #${id} marked as '${status}' with response: ${admin_response || 'None'}`
  );

  return { success: true, message: `Feedback marked as ${status}` };
}

export async function deleteFeedback(id: any) {
  await run('DELETE FROM feedbacks WHERE id = ?', [id]);
  return { success: true, message: 'Feedback entry deleted' };
}
