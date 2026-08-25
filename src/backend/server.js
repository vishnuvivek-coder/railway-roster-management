const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { initDb, run, all, get } = require('./db');
const { getDayOffset, getBaseLinkNumber } = require('./rotation');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'railway_roster_luxury_editorial_secret_2026';

app.use(cors());
app.use(bodyParser.json());

// Initialize Database on startup
initDb().then(() => {
  console.log('Database loaded and ready.');
}).catch(err => {
  console.error('Database initialization failed:', err);
});

// Helper: Log audit action
async function logAudit(role, actionType, description) {
  try {
    await run(
      'INSERT INTO audit_logs (user_role, action_type, description) VALUES (?, ?, ?)',
      [role, actionType, description]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// Auth Middleware: Extract JWT user if present
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) req.user = null;
    else req.user = user;
    next();
  });
}

// Middleware: Enforce Admin Role for Write/Edit Operations
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Permission denied: Administrator privileges required to modify data.' });
  }
  next();
}

app.use(authenticateToken);

// Helper: Get active link definition for a link number on a given date
async function getActiveLinkDef(categoryId, linkNumber, dateStr) {
  const link = await get(
    `SELECT * FROM links 
     WHERE category_id = ? AND link_number = ? 
       AND date(effective_from) <= date(?) 
       AND date(effective_to) >= date(?)`,
    [categoryId, linkNumber, dateStr, dateStr]
  );
  return link || { link_number: linkNumber, is_rest: 1, train_numbers: 'REST', from_station: '', to_station: '', coaches: '' };
}

// ----------------------------------------------------
// AUTHENTICATION & USER MANAGEMENT API
// ----------------------------------------------------

// Register New Employee / User
app.post('/api/auth/register', async (req, res) => {
  const { username, name, email, password, role, staff_id } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ error: 'Username, Full Name, and Password are required.' });
  }

  if (password.length < 5) {
    return res.status(400).json({ error: 'Password must be at least 5 characters long.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    // Check if username already taken
    const existing = await get('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existing) {
      return res.status(400).json({ error: 'This username is already registered. Please choose another.' });
    }

    if (email && email.trim()) {
      const existingEmail = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      if (existingEmail) {
        return res.status(400).json({ error: 'This email is already associated with an account.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const assignedRole = role === 'Admin' ? 'Staff' : (role || 'Staff'); // Only Master Admin can elevate to Admin

    const result = await run(
      `INSERT INTO users (username, name, email, password_hash, role, status, staff_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
      [cleanUsername, name.trim(), email ? email.trim().toLowerCase() : null, passwordHash, assignedRole, staff_id || null]
    );

    await logAudit('System', 'USER_REGISTER', `New user registration: ${cleanUsername} (${name}) - Status: PENDING`);

    res.json({
      success: true,
      message: 'Account registration submitted successfully! Your account is pending administrator verification.',
      status: 'PENDING',
      userId: result.lastID
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    const user = await get(
      'SELECT id, username, name, email, password_hash, role, status, staff_id, created_at, approved_at, approved_by FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanUsername]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Status verification check
    if (user.status === 'PENDING') {
      return res.status(403).json({
        error: 'Your account is currently PENDING verification by the Administrator. Please contact the Master Admin to approve your account.',
        status: 'PENDING'
      });
    }

    if (user.status === 'REJECTED') {
      return res.status(403).json({
        error: 'Your account registration was not approved or has been suspended. Please contact the administrator.',
        status: 'REJECTED'
      });
    }

    // Issue JWT Token for approved user
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        status: user.status
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await logAudit(user.role, 'USER_LOGIN', `User ${user.username} (${user.name}) logged in`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        staff_id: user.staff_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Verify Current User Session
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get(
      'SELECT id, username, name, email, role, status, staff_id, created_at, approved_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user || user.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Account not active or not approved' });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
});

// Admin: List all registered users with verification status
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await all(`
      SELECT u.id, u.username, u.name, u.email, u.role, u.status, u.staff_id, 
             u.created_at, u.approved_at, u.approved_by,
             s.name as staff_name, s.designation as staff_designation
      FROM users u
      LEFT JOIN staff s ON u.staff_id = s.id
      ORDER BY 
        CASE 
          WHEN u.status = 'PENDING' THEN 0 
          WHEN u.status = 'APPROVED' THEN 1 
          ELSE 2 
        END, 
        u.created_at DESC
    `);

    const counts = {
      total: users.length,
      pending: users.filter(u => u.status === 'PENDING').length,
      approved: users.filter(u => u.status === 'APPROVED').length,
      rejected: users.filter(u => u.status === 'REJECTED').length
    };

    res.json({ users, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Approve a user registration
app.put('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const approver = req.user ? req.user.username : 'Admin';

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run(
      `UPDATE users SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
      [approver, id]
    );

    await logAudit('Admin', 'APPROVE_USER', `Approved user account: ${targetUser.username} (${targetUser.name}) by ${approver}`);

    res.json({ success: true, message: `User ${targetUser.name} (${targetUser.username}) has been approved and can now log in.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Reject a user registration
app.put('/api/admin/users/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const rejecter = req.user ? req.user.username : 'Admin';

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Cannot reject the Master Admin account.' });
    }

    await run(
      `UPDATE users SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
      [rejecter, id]
    );

    await logAudit('Admin', 'REJECT_USER', `Rejected user account: ${targetUser.username} (${targetUser.name}) by ${rejecter}`);

    res.json({ success: true, message: `User ${targetUser.name} (${targetUser.username}) registration has been rejected.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update user role
app.put('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['Admin', 'Staff', 'Viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be Admin, Staff, or Viewer.' });
  }

  try {
    const targetUser = await get('SELECT username, name, role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    await logAudit('Admin', 'CHANGE_USER_ROLE', `Changed role for ${targetUser.username} from ${targetUser.role} to ${role}`);

    res.json({ success: true, message: `Role for ${targetUser.username} updated to ${role}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete a user
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the Master Admin account.' });
    }

    await run('DELETE FROM users WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_USER', `Deleted user account: ${targetUser.username} (${targetUser.name})`);

    res.json({ success: true, message: `User ${targetUser.username} deleted successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// CATEGORY API
// ----------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await all('SELECT * FROM categories');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireAdmin, async (req, res) => {
  const { name, code, cycle_length, anchor_date } = req.body;
  if (!name || !code || !cycle_length || !anchor_date) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const result = await run(
      'INSERT INTO categories (name, code, cycle_length, anchor_date) VALUES (?, ?, ?, ?)',
      [name, code, cycle_length, anchor_date]
    );
    await logAudit('Admin', 'CREATE_CATEGORY', `Created category ${name} (${code})`);
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, code, cycle_length, anchor_date } = req.body;
  try {
    await run(
      'UPDATE categories SET name = ?, code = ?, cycle_length = ?, anchor_date = ? WHERE id = ?',
      [name, code, cycle_length, anchor_date, id]
    );
    await logAudit('Admin', 'UPDATE_CATEGORY', `Updated category ID ${id} to ${name}`);
    res.json({ message: 'Category updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const category = await get('SELECT name FROM categories WHERE id = ?', [id]);
    await run('DELETE FROM categories WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_CATEGORY', `Deleted category ${category?.name} (ID: ${id})`);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// STAFF API
// ----------------------------------------------------
app.get('/api/staff', async (req, res) => {
  const { category_id } = req.query;
  try {
    let sql = 'SELECT * FROM staff';
    let params = [];
    if (category_id) {
      sql += ' WHERE category_id = ? ORDER BY row_position';
      params.push(category_id);
    } else {
      sql += ' ORDER BY category_id, row_position';
    }
    const staff = await all(sql, params);
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff', requireAdmin, async (req, res) => {
  const { name, designation, category_id, row_position } = req.body;
  if (!name || !category_id) {
    return res.status(400).json({ error: 'Name and Category ID are required' });
  }
  try {
    let pos = row_position;
    if (!pos) {
      const maxPos = await get('SELECT MAX(row_position) as maxPos FROM staff WHERE category_id = ?', [category_id]);
      pos = (maxPos.maxPos || 0) + 1;
    } else {
      // Shift other staff members down if row_position is manually specified
      await run(
        'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ?',
        [category_id, pos]
      );
    }

    const result = await run(
      'INSERT INTO staff (name, designation, category_id, row_position) VALUES (?, ?, ?, ?)',
      [name, designation || null, category_id, pos]
    );

    await logAudit('Admin', 'ADD_STAFF', `Added staff member '${name}' at position ${pos}`);
    res.json({ id: result.lastID, row_position: pos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff/reorder', requireAdmin, async (req, res) => {
  const { reorders } = req.body; // Array of { id, row_position }
  if (!Array.isArray(reorders)) {
    return res.status(400).json({ error: 'Invalid reorders data' });
  }
  try {
    for (const item of reorders) {
      await run('UPDATE staff SET row_position = ? WHERE id = ?', [item.row_position, item.id]);
    }
    await logAudit('Admin', 'REORDER_STAFF', 'Reordered staff seniority/row positions');
    res.json({ message: 'Staff reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/staff/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, designation, row_position, active } = req.body;
  try {
    const currentStaff = await get('SELECT * FROM staff WHERE id = ?', [id]);
    if (!currentStaff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (row_position && row_position !== currentStaff.row_position) {
      const catId = currentStaff.category_id;
      // Shift others
      if (row_position > currentStaff.row_position) {
        await run(
          'UPDATE staff SET row_position = row_position - 1 WHERE category_id = ? AND row_position > ? AND row_position <= ?',
          [catId, currentStaff.row_position, row_position]
        );
      } else {
        await run(
          'UPDATE staff SET row_position = row_position + 1 WHERE category_id = ? AND row_position >= ? AND row_position < ?',
          [catId, row_position, currentStaff.row_position]
        );
      }
    }

    await run(
      `UPDATE staff 
       SET name = ?, designation = ?, row_position = COALESCE(?, row_position), active = COALESCE(?, active) 
       WHERE id = ?`,
      [name, designation || null, row_position || null, active !== undefined ? active : null, id]
    );

    await logAudit('Admin', 'UPDATE_STAFF', `Updated staff member ID ${id} (${name})`);
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/staff/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await run('DELETE FROM staff WHERE id = ?', [id]);
    
    // Shift all subsequent staff up to close the gap
    await run(
      'UPDATE staff SET row_position = row_position - 1 WHERE category_id = ? AND row_position > ?',
      [staff.category_id, staff.row_position]
    );

    await logAudit('Admin', 'DELETE_STAFF', `Deleted staff member '${staff.name}'`);
    res.json({ message: 'Staff member deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LINK MASTER API
// ----------------------------------------------------
app.get('/api/links', async (req, res) => {
  const { category_id } = req.query;
  try {
    let sql = 'SELECT * FROM links';
    let params = [];
    if (category_id) {
      sql += ' WHERE category_id = ? ORDER BY link_number, effective_from';
      params.push(category_id);
    } else {
      sql += ' ORDER BY category_id, link_number, effective_from';
    }
    const links = await all(sql, params);
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links/reorder', requireAdmin, async (req, res) => {
  const { reorders } = req.body;
  if (!Array.isArray(reorders)) {
    return res.status(400).json({ error: 'Invalid reorders data' });
  }
  try {
    for (const item of reorders) {
      await run('UPDATE links SET link_number = ? WHERE id = ?', [item.link_number, item.id]);
    }
    await logAudit('Admin', 'REORDER_LINKS', 'Reordered train roster / link numbers');
    res.json({ message: 'Links reordered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links', requireAdmin, async (req, res) => {
  const { category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_type, set_name } = req.body;
  if (!category_id || !link_number || !effective_from) {
    return res.status(400).json({ error: 'Category ID, Link Number and Effective From date are required' });
  }
  try {
    // Check if there is an overlapping link definition and set its effective_to
    const previous = await get(
      `SELECT * FROM links 
       WHERE category_id = ? AND link_number = ? AND effective_to = '9999-12-31' 
         AND date(effective_from) < date(?)`,
      [category_id, link_number, effective_from]
    );
    if (previous) {
      // Calculate one day before effective_from
      const prevEnd = new Date(new Date(effective_from) - 86400000).toISOString().split('T')[0];
      await run('UPDATE links SET effective_to = ? WHERE id = ?', [prevEnd, previous.id]);
    }

    const result = await run(
      `INSERT INTO links (category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest, effective_from, set_type, set_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, link_number, train_numbers, from_station, to_station, coaches, is_rest ? 1 : 0, effective_from, set_type || '2-Day Set', set_name || null]
    );

    await logAudit('Admin', 'CREATE_LINK', `Created Link ${link_number} for Category ${category_id}`);
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/links/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  console.log('PUT /api/links/:id body:', req.body);
  const { train_numbers, from_station, to_station, coaches, is_rest, effective_from, effective_to, set_type, set_name } = req.body;
  try {
    await run(
      `UPDATE links 
       SET train_numbers = ?, from_station = ?, to_station = ?, coaches = ?, is_rest = ?, effective_from = ?, effective_to = ?, set_type = ?, set_name = ? 
       WHERE id = ?`,
      [train_numbers, from_station, to_station, coaches, is_rest ? 1 : 0, effective_from, effective_to || '9999-12-31', set_type || '2-Day Set', set_name !== undefined ? set_name : null, id]
    );
    await logAudit('Admin', 'UPDATE_LINK', `Updated Link ID ${id}`);
    res.json({ message: 'Link updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/links/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM links WHERE id = ?', [id]);
    await logAudit('Admin', 'DELETE_LINK', `Deleted Link ID ${id}`);
    res.json({ message: 'Link deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/links/clear-all', requireAdmin, async (req, res) => {
  try {
    await run('DELETE FROM links');
    await logAudit('Admin', 'CLEAR_ALL_LINKS', 'Cleared all roster links / train entries');
    res.json({ message: 'All links cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// MANUAL OVERRIDES & AUDIT TRAIL API
// ----------------------------------------------------
app.post('/api/overrides', requireAdmin, async (req, res) => {
  const { staff_id, date, overridden_link_number, reason } = req.body;
  if (!staff_id || !date || reason === undefined || reason === null) {
    return res.status(400).json({ error: 'Staff ID, date and reason are required' });
  }
  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    
    // Compute original link number using rotation formula
    const dayOffset = getDayOffset(category.anchor_date, date);
    const originalLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);

    // Upsert override
    await run(
      `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
       VALUES (?, ?, ?, ?, ?) 
       ON CONFLICT(staff_id, date) 
       DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason`,
      [staff_id, date, originalLink, overridden_link_number, reason]
    );

    const targetDesc = overridden_link_number === null ? 'REST' : `Link ${overridden_link_number}`;
    await logAudit(
      'Admin',
      'MANUAL_OVERRIDE',
      `Overrode ${staff.name} on ${date} from Link ${originalLink} to ${targetDesc}. Reason: ${reason}`
    );

    res.json({ message: 'Override applied successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/overrides/audit', async (req, res) => {
  try {
    const logs = await all(`
      SELECT o.*, s.name as staff_name, s.designation as staff_desg, c.name as category_name 
      FROM overrides o 
      JOIN staff s ON o.staff_id = s.id 
      JOIN categories c ON s.category_id = c.id 
      ORDER BY o.created_at DESC
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 200');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// LEAVE & SWAP REQUESTS API
// ----------------------------------------------------
app.get('/api/leave-requests', async (req, res) => {
  try {
    const requests = await all(`
      SELECT lr.*, 
             s.name as staff_name, s.designation as staff_desg, s.category_id,
             ss.name as swap_staff_name, ss.designation as swap_staff_desg 
      FROM leave_requests lr
      JOIN staff s ON lr.staff_id = s.id
      LEFT JOIN staff ss ON lr.swap_staff_id = ss.id
      ORDER BY lr.date DESC
    `);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests', async (req, res) => {
  const { staff_id, date, type, swap_staff_id, reason } = req.body;
  if (!staff_id || !date || !type) {
    return res.status(400).json({ error: 'Staff ID, date and type are required' });
  }
  try {
    const result = await run(
      'INSERT INTO leave_requests (staff_id, date, type, swap_staff_id, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [staff_id, date, type.toUpperCase(), swap_staff_id || null, reason || '', 'PENDING']
    );
    res.json({ id: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests/:id/approve', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const request = await get('SELECT * FROM leave_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const staffA = await get('SELECT * FROM staff WHERE id = ?', [request.staff_id]);
    const cat = await get('SELECT * FROM categories WHERE id = ?', [staffA.category_id]);
    const dayOffset = getDayOffset(cat.anchor_date, request.date);

    // Apply the leave or swap logic to create overrides
    if (request.type === 'LEAVE') {
      // Calculate original
      const origLink = getBaseLinkNumber(staffA.row_position, dayOffset, cat.cycle_length);
      // Create override for staffA to REST (null)
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
         VALUES (?, ?, ?, NULL, ?) 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = NULL, reason = ?`,
        [staffA.id, request.date, origLink, `Approved Leave: ${request.reason}`, `Approved Leave: ${request.reason}`]
      );
      await logAudit('Admin', 'APPROVE_LEAVE', `Approved leave for ${staffA.name} on ${request.date}`);
    } else if (request.type === 'SWAP') {
      const staffB = await get('SELECT * FROM staff WHERE id = ?', [request.swap_staff_id]);
      if (!staffB) {
        return res.status(400).json({ error: 'Swap staff member not found' });
      }

      // Compute original links on that day
      const origLinkA = getBaseLinkNumber(staffA.row_position, dayOffset, cat.cycle_length);
      const origLinkB = getBaseLinkNumber(staffB.row_position, dayOffset, cat.cycle_length);

      // Check if there are already overrides to resolve
      const activeOverrideA = await get('SELECT overridden_link_number FROM overrides WHERE staff_id = ? AND date = ?', [staffA.id, request.date]);
      const activeOverrideB = await get('SELECT overridden_link_number FROM overrides WHERE staff_id = ? AND date = ?', [staffB.id, request.date]);

      const dutyA = activeOverrideA !== undefined ? activeOverrideA.overridden_link_number : origLinkA;
      const dutyB = activeOverrideB !== undefined ? activeOverrideB.overridden_link_number : origLinkB;

      // Swap their current active duties on this date
      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason`,
        [staffA.id, request.date, origLinkA, dutyB, `Swap with ${staffB.name}`]
      );

      await run(
        `INSERT INTO overrides (staff_id, date, original_link_number, overridden_link_number, reason) 
         VALUES (?, ?, ?, ?, ?) 
         ON CONFLICT(staff_id, date) DO UPDATE SET overridden_link_number = excluded.overridden_link_number, reason = excluded.reason`,
        [staffB.id, request.date, origLinkB, dutyA, `Swap with ${staffA.name}`]
      );

      await logAudit('Admin', 'APPROVE_SWAP', `Approved swap between ${staffA.name} and ${staffB.name} on ${request.date}`);
    }

    // Update request status
    await run(
      "UPDATE leave_requests SET status = 'APPROVED', approved_by = 'Admin', approved_at = datetime('now') WHERE id = ?",
      [id]
    );

    res.json({ message: 'Request approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/leave-requests/:id/reject', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await run(
      "UPDATE leave_requests SET status = 'REJECTED', reason = ? WHERE id = ?",
      [reason || 'Rejected by Admin', id]
    );
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// ROSTER GENERATION API
// ----------------------------------------------------
app.get('/api/roster', async (req, res) => {
  const { category_id, year, month } = req.query;
  if (!category_id || !year || !month) {
    return res.status(400).json({ error: 'Category ID, year and month are required' });
  }

  try {
    const category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const staffMembers = await all(
      'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
      [category_id]
    );

    // Get number of days in target month
    const numDays = new Date(year, month, 0).getDate();
    
    // Get all overrides for staff members in this category during this month
    const staffIdsList = staffMembers.map(s => s.id).join(',');
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(numDays).padStart(2, '0')}`;
    
    let overrides = [];
    if (staffMembers.length > 0) {
      overrides = await all(
        `SELECT * FROM overrides 
         WHERE staff_id IN (${staffIdsList}) 
           AND date(date) >= date(?) AND date(date) <= date(?)`,
        [startDate, endDate]
      );
    }
    
    // Index overrides by staff_id + date
    const overrideMap = {};
    overrides.forEach(o => {
      overrideMap[`${o.staff_id}_${o.date}`] = o;
    });

    const dates = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 1; day <= numDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(year, month - 1, day);
      dates.push({
        dayOfMonth: day,
        dateString: dateStr,
        dayOfWeek: weekdayNames[dObj.getDay()],
        dayOffset: getDayOffset(category.anchor_date, dateStr)
      });
    }

    // Build the grid
    const gridRows = [];
    for (const staff of staffMembers) {
      const rowCells = [];
      
      for (const d of dates) {
        const key = `${staff.id}_${d.dateString}`;
        const override = overrideMap[key];
        
        let linkNum = null;
        let isOverridden = false;
        let overrideReason = '';

        if (override) {
          linkNum = override.overridden_link_number; // can be null (REST)
          isOverridden = true;
          overrideReason = override.reason;
        } else {
          linkNum = getBaseLinkNumber(staff.row_position, d.dayOffset, category.cycle_length);
        }

        let dutyDetails = null;
        if (linkNum !== null) {
          dutyDetails = await getActiveLinkDef(category_id, linkNum, d.dateString);
        }

        rowCells.push({
          date: d.dateString,
          dayOffset: d.dayOffset,
          calculatedLinkNumber: getBaseLinkNumber(staff.row_position, d.dayOffset, category.cycle_length),
          actualLinkNumber: linkNum,
          isRest: linkNum === null || (dutyDetails && dutyDetails.is_rest === 1),
          isOverridden,
          overrideReason,
          train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
          from_station: dutyDetails ? dutyDetails.from_station : '',
          to_station: dutyDetails ? dutyDetails.to_station : '',
          coaches: dutyDetails ? dutyDetails.coaches : '',
          set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
        });
      }

      gridRows.push({
        staffId: staff.id,
        staffName: staff.name,
        designation: staff.designation,
        rowPosition: staff.row_position,
        active: staff.active,
        cells: rowCells
      });
    }

    res.json({
      category,
      dates,
      rows: gridRows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// REPORTING LOOKUPS API
// ----------------------------------------------------

// "Who is working link X on date Y?"
app.get('/api/reports/who-is-working', async (req, res) => {
  const { category_id, link_number, date } = req.query;
  if (!category_id || !link_number || !date) {
    return res.status(400).json({ error: 'category_id, link_number and date are required' });
  }

  try {
    const category = await get('SELECT * FROM categories WHERE id = ?', [category_id]);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const staffMembers = await all('SELECT * FROM staff WHERE category_id = ? ORDER BY row_position', [category_id]);
    const dayOffset = getDayOffset(category.anchor_date, date);
    const linkTarget = parseInt(link_number, 10);

    const matches = [];
    for (const staff of staffMembers) {
      // check override
      const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
      let activeLink = null;
      if (override) {
        activeLink = override.overridden_link_number;
      } else {
        activeLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
      }

      if (activeLink === linkTarget) {
        matches.push(staff);
      }
    }

    res.json({ date, link_number: linkTarget, matches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "What is person Z working on date Y?"
app.get('/api/reports/what-is-person-working', async (req, res) => {
  const { staff_id, date } = req.query;
  if (!staff_id || !date) {
    return res.status(400).json({ error: 'staff_id and date are required' });
  }

  try {
    const staff = await get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    const category = await get('SELECT * FROM categories WHERE id = ?', [staff.category_id]);
    const dayOffset = getDayOffset(category.anchor_date, date);

    const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
    let activeLink = null;
    let isOverridden = false;
    let overrideReason = '';

    if (override) {
      activeLink = override.overridden_link_number;
      isOverridden = true;
      overrideReason = override.reason;
    } else {
      activeLink = getBaseLinkNumber(staff.row_position, dayOffset, category.cycle_length);
    }

    let dutyDetails = null;
    if (activeLink !== null) {
      dutyDetails = await getActiveLinkDef(staff.category_id, activeLink, date);
    }

    res.json({
      staff,
      date,
      link_number: activeLink,
      isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
      isOverridden,
      overrideReason,
      duty: dutyDetails ? {
        train_numbers: dutyDetails.train_numbers,
        from_station: dutyDetails.from_station,
        to_station: dutyDetails.to_station,
        coaches: dutyDetails.coaches
      } : { train_numbers: 'REST', from_station: '', to_station: '', coaches: '' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Daily view: for a chosen date, list every staff member and their assigned link/duty
app.get('/api/reports/daily-view', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const categories = await all('SELECT * FROM categories');
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

      const staffDuties = [];
      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;
        let isOverridden = false;
        
        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        staffDuties.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          rowPosition: staff.row_position,
          link_number: activeLink,
          isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
          isOverridden,
          train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
          from_station: dutyDetails ? dutyDetails.from_station : '',
          to_station: dutyDetails ? dutyDetails.to_station : '',
          coaches: dutyDetails ? dutyDetails.coaches : '',
          set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
        });
      }

      // Sort daily duties by link number ascending to keep a fixed order of trains/links
      staffDuties.sort((a, b) => {
        const linkA = a.link_number === null ? 999999 : a.link_number;
        const linkB = b.link_number === null ? 999999 : b.link_number;
        return linkA - linkB;
      });

      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        staff: staffDuties
      });
    }

    res.json({ date, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch register entries for a selected date
app.get('/api/duty-register', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const entries = await all('SELECT * FROM duty_register_entry WHERE date = ?', [date]);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update register entries for a selected date (Transaction based)
app.post('/api/duty-register', requireAdmin, async (req, res) => {
  const { date, page_number, entries } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'Entries must be an array' });

  try {
    await run('BEGIN TRANSACTION');
    // Fetch and delete existing entries for this date
    const existing = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    for (const e of existing) {
      await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [e.id]);
    }
    await run('DELETE FROM duty_register_entry WHERE date = ?', [date]);

    for (const item of entries) {
      const result = await run(
        `INSERT INTO duty_register_entry 
         (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          date,
          page_number ? parseInt(page_number, 10) : null,
          item.train_out || '',
          item.coach_out || '',
          item.train_return || '',
          item.coach_return || '',
          item.duty_label || '',
          item.notes || ''
        ]
      );
      const entryId = result.lastID;
      if (Array.isArray(item.staff_ids)) {
        for (const staffId of item.staff_ids) {
          await run(
            'INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)',
            [entryId, staffId]
          );
        }
      }
    }
    await run('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await run('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Delete a register entry
app.delete('/api/duty-register/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await run('DELETE FROM duty_register_staff WHERE entry_id = ?', [id]);
    await run('DELETE FROM duty_register_entry WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pre-populate actual duty register from planned roster
app.post('/api/duty-register/populate-from-roster', requireAdmin, async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const existingEntries = await all('SELECT id FROM duty_register_entry WHERE date = ?', [date]);
    if (existingEntries.length > 0) {
      const ids = existingEntries.map(e => e.id).join(',');
      await run(`DELETE FROM duty_register_staff WHERE entry_id IN (${ids})`);
      await run(`DELETE FROM duty_register_entry WHERE id IN (${ids})`);
    }

    const categories = await all('SELECT * FROM categories');
    
    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;

        if (override) {
          activeLink = override.overridden_link_number;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const isRest = activeLink === null || (dutyDetails && dutyDetails.is_rest === 1);
        
        let train_out = '';
        let coach_out = '';
        let train_return = '';
        let coach_return = '';
        let duty_label = isRest ? 'REST' : '';

        if (!isRest && dutyDetails) {
          const trains = parseTrainNumbers(dutyDetails.train_numbers);
          train_out = trains[0] || '';
          train_return = trains[1] || trains[0] || '';
          coach_out = dutyDetails.coaches || '';
          coach_return = dutyDetails.coaches || '';
          duty_label = `Link #${activeLink}`;
        }

        const result = await run(
          `INSERT INTO duty_register_entry 
           (date, page_number, train_out, coach_out, train_return, coach_return, duty_label, notes)
           VALUES (?, 1, ?, ?, ?, ?, ?, ?)`,
          [date, train_out, coach_out, train_return, coach_return, duty_label, 'Auto-populated from roster']
        );
        
        const entryId = result.lastID;
        await run(
          `INSERT INTO duty_register_staff (entry_id, staff_id) VALUES (?, ?)`,
          [entryId, staff.id]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reconciliation comparison endpoint
app.get('/api/duty-register/reconciliation', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required' });

  try {
    const categories = await all('SELECT * FROM categories');
    const result = [];

    for (const cat of categories) {
      const staffMembers = await all(
        'SELECT * FROM staff WHERE category_id = ? ORDER BY row_position',
        [cat.id]
      );
      const dayOffset = getDayOffset(cat.anchor_date, date);

      // Fetch all entries joined with staff for this category on this date
      const entries = await all(
        `SELECT e.*, s.id as staff_id 
         FROM duty_register_entry e
         JOIN duty_register_staff drs ON e.id = drs.entry_id
         JOIN staff s ON drs.staff_id = s.id
         WHERE e.date = ? AND s.category_id = ?`,
        [date, cat.id]
      );

      // Map entry crew members
      const entryCrewMap = {};
      for (const e of entries) {
        if (!entryCrewMap[e.id]) {
          const crew = await all(
            `SELECT s.name FROM staff s
             JOIN duty_register_staff drs ON s.id = drs.staff_id
             WHERE drs.entry_id = ?`,
            [e.id]
          );
          entryCrewMap[e.id] = crew.map(c => c.name);
        }
      }

      const list = [];
      for (const staff of staffMembers) {
        const override = await get('SELECT * FROM overrides WHERE staff_id = ? AND date = ?', [staff.id, date]);
        let activeLink = null;
        let isOverridden = false;

        if (override) {
          activeLink = override.overridden_link_number;
          isOverridden = true;
        } else {
          activeLink = getBaseLinkNumber(staff.row_position, dayOffset, cat.cycle_length);
        }

        let dutyDetails = null;
        if (activeLink !== null) {
          dutyDetails = await getActiveLinkDef(cat.id, activeLink, date);
        }

        const planned = {
          link_number: activeLink,
          isRest: activeLink === null || (dutyDetails && dutyDetails.is_rest === 1),
          isOverridden,
          train_numbers: dutyDetails ? dutyDetails.train_numbers : 'REST',
          from_station: dutyDetails ? dutyDetails.from_station : '',
          to_station: dutyDetails ? dutyDetails.to_station : '',
          coaches: dutyDetails ? dutyDetails.coaches : '',
          set_type: dutyDetails ? dutyDetails.set_type : 'Other / REST'
        };

        const actualEntry = entries.find(e => e.staff_id === staff.id);
        const actual = actualEntry ? {
          entryId: actualEntry.id,
          train_out: actualEntry.train_out,
          coach_out: actualEntry.coach_out,
          train_return: actualEntry.train_return,
          coach_return: actualEntry.coach_return,
          duty_label: actualEntry.duty_label,
          notes: actualEntry.notes,
          crew: entryCrewMap[actualEntry.id] || []
        } : null;

        let isMismatch = false;
        let mismatchReason = '';

        if (planned.isRest) {
          if (actual) {
            isMismatch = true;
            mismatchReason = `Rostered for REST but worked: ${actual.duty_label || actual.train_out}`;
          }
        } else {
          if (!actual) {
            isMismatch = true;
            mismatchReason = `Rostered for duty (${planned.train_numbers}) but absent in register`;
          } else {
            const pTrains = parseTrainNumbers(planned.train_numbers);
            const actTrains = [];
            if (actual.train_out) actTrains.push(actual.train_out);
            if (actual.train_return) actTrains.push(actual.train_return);

            // Match train numbers
            const trainMismatch = pTrains.length > 0 && actTrains.length > 0 &&
              !pTrains.some(pt => actTrains.some(at => at.includes(pt) || pt.includes(at)));
            
            // Match coaches
            const coachMismatch = planned.coaches && actual.coach_out &&
              !planned.coaches.includes(actual.coach_out) && !actual.coach_out.includes(planned.coaches);

            if (trainMismatch) {
              isMismatch = true;
              mismatchReason = `Train mismatch: Planned ${planned.train_numbers} vs Actual ${actTrains.join('/')}`;
            } else if (coachMismatch) {
              isMismatch = true;
              mismatchReason = `Coach mismatch: Planned ${planned.coaches} vs Actual ${actual.coach_out}`;
            }
          }
        }

        list.push({
          staffId: staff.id,
          name: staff.name,
          designation: staff.designation,
          planned,
          actual,
          isMismatch,
          mismatchReason
        });
      }

      result.push({
        categoryId: cat.id,
        categoryName: cat.name,
        categoryCode: cat.code,
        reconciliation: list
      });
    }

    res.json({ date, categories: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch register history logs
app.get('/api/duty-register/history', async (req, res) => {
  const { q, startDate, endDate } = req.query;

  try {
    let sql = `
      SELECT DISTINCT e.*
      FROM duty_register_entry e
      LEFT JOIN duty_register_staff drs ON e.id = drs.entry_id
      LEFT JOIN staff s ON drs.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND e.date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND e.date <= ?';
      params.push(endDate);
    }
    if (q) {
      sql += ' AND (s.name LIKE ? OR e.train_out LIKE ? OR e.train_return LIKE ? OR e.duty_label LIKE ?)';
      const queryParam = `%${q}%`;
      params.push(queryParam, queryParam, queryParam, queryParam);
    }
    sql += ' ORDER BY e.date DESC, e.id ASC';

    const entries = await all(sql, params);
    for (const entry of entries) {
      const staff = await all(
        'SELECT s.* FROM staff s JOIN duty_register_staff drs ON s.id = drs.staff_id WHERE drs.entry_id = ?',
        [entry.id]
      );
      entry.staff = staff;
    }
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve compiled frontend in production (Single-Server Cloud Architecture)
const possibleDistPaths = [
  path.join(__dirname, '..', 'frontend', 'dist'),
  path.join(process.cwd(), 'src', 'frontend', 'dist'),
  path.join(process.cwd(), 'dist'),
  path.join(__dirname, 'dist')
];

let frontendDistPath = possibleDistPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

// Disable caching for HTML and Service Worker so asset hash updates load instantly
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

if (frontendDistPath) {
  console.log(`[Production] Serving frontend from: ${frontendDistPath}`);
  app.use(express.static(frontendDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  console.warn('[Production] Frontend dist directory not found yet.');
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Railway Duty Roster Manager</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0D0D0F; color: #F2F0EB; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1A1A1D; border: 1px solid #D4A15C; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.7); }
          h2 { color: #D4A15C; margin-top: 0; }
          .btn { background: #D4A15C; color: #0D0D0F; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🚆 Railway Duty Roster Manager</h2>
          <p>The backend server is online! Frontend assets are initializing. This page will refresh automatically in 5 seconds...</p>
          <a class="btn" href="javascript:location.reload()">Refresh Page</a>
        </div>
      </body>
      </html>
    `);
  });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Roster backend server is running on port ${PORT}`);
});
