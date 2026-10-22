import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get, all } from '../db';
import { JWT_SECRET } from '../middlewares/auth.middleware';
import { logAudit } from './audit.service';

export async function registerUser(body: any) {
  const { username, name, email, password, role, staff_id } = body;
  if (!username || !name || !password) {
    throw { status: 400, message: 'Username, Full Name, and Password are required.' };
  }

  if (password.length < 5) {
    throw { status: 400, message: 'Password must be at least 5 characters long.' };
  }

  const cleanUsername = username.trim().toLowerCase();

  const existing = await get('SELECT id FROM users WHERE username = ?', [cleanUsername]);
  if (existing) {
    throw { status: 400, message: 'This username is already registered. Please choose another.' };
  }

  if (email && email.trim()) {
    const existingEmail = await get('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existingEmail) {
      throw { status: 400, message: 'This email is already associated with an account.' };
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const assignedRole = role === 'Admin' ? 'Staff' : (role || 'Staff');

  const result = await run(
    `INSERT INTO users (username, name, email, password_hash, role, status, staff_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP)`,
    [cleanUsername, name.trim(), email ? email.trim().toLowerCase() : null, passwordHash, assignedRole, staff_id || null]
  );

  await logAudit('System', 'USER_REGISTER', `New user registration: ${cleanUsername} (${name}) - Status: PENDING`);

  return {
    success: true,
    message: 'Account registration submitted successfully! Your account is pending administrator verification.',
    status: 'PENDING',
    userId: result.lastID
  };
}

export async function loginUser(body: any) {
  const { username, password } = body;
  if (!username || !password) {
    throw { status: 400, message: 'Username and password are required.' };
  }

  const cleanUsername = username.trim().toLowerCase();

  const user = await get(
    'SELECT id, username, name, email, password_hash, role, status, staff_id, created_at, approved_at, approved_by FROM users WHERE username = ? OR email = ?',
    [cleanUsername, cleanUsername]
  );

  if (!user) {
    throw { status: 401, message: 'Invalid username or password.' };
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw { status: 401, message: 'Invalid username or password.' };
  }

  if (user.status === 'PENDING') {
    throw {
      status: 403,
      message: 'Your account is currently PENDING verification by the Administrator. Please contact the Master Admin to approve your account.',
      extra: { status: 'PENDING' }
    };
  }

  if (user.status === 'REJECTED') {
    throw {
      status: 403,
      message: 'Your account registration was not approved or has been suspended. Please contact the administrator.',
      extra: { status: 'REJECTED' }
    };
  }

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

  return {
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
  };
}

export async function getCurrentUser(token: string | undefined) {
  if (!token) {
    throw { status: 401, message: 'Not authenticated' };
  }
  const decoded: any = jwt.verify(token, JWT_SECRET);
  const user = await get(
    'SELECT id, username, name, email, role, status, staff_id, created_at, approved_at FROM users WHERE id = ?',
    [decoded.id]
  );

  if (!user || user.status !== 'APPROVED') {
    throw { status: 403, message: 'Account not active or not approved' };
  }
  return { user };
}

export async function getAdminUsers() {
  const users: any[] = await all(`
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

  return { users, counts };
}

export async function approveUser(id: any, approver: string) {
  const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
  if (!targetUser) {
    throw { status: 404, message: 'User not found' };
  }

  await run(
    `UPDATE users SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
    [approver, id]
  );

  await logAudit('Admin', 'APPROVE_USER', `Approved user account: ${targetUser.username} (${targetUser.name}) by ${approver}`);
  return { success: true, message: `User ${targetUser.name} (${targetUser.username}) has been approved and can now log in.` };
}

export async function rejectUser(id: any, rejecter: string) {
  const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
  if (!targetUser) {
    throw { status: 404, message: 'User not found' };
  }

  if (targetUser.username === 'admin') {
    throw { status: 400, message: 'Cannot reject the Master Admin account.' };
  }

  await run(
    `UPDATE users SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?`,
    [rejecter, id]
  );

  await logAudit('Admin', 'REJECT_USER', `Rejected user account: ${targetUser.username} (${targetUser.name}) by ${rejecter}`);
  return { success: true, message: `User ${targetUser.name} (${targetUser.username}) registration has been rejected.` };
}

export async function updateUserRole(id: any, role: string) {
  if (!role || !['Admin', 'Staff', 'Viewer'].includes(role)) {
    throw { status: 400, message: 'Invalid role. Must be Admin, Staff, or Viewer.' };
  }

  const targetUser = await get('SELECT username, name, role FROM users WHERE id = ?', [id]);
  if (!targetUser) {
    throw { status: 404, message: 'User not found' };
  }

  await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  await logAudit('Admin', 'CHANGE_USER_ROLE', `Changed role for ${targetUser.username} from ${targetUser.role} to ${role}`);
  return { success: true, message: `Role for ${targetUser.username} updated to ${role}.` };
}

export async function deleteUser(id: any) {
  const targetUser = await get('SELECT username, name FROM users WHERE id = ?', [id]);
  if (!targetUser) {
    throw { status: 404, message: 'User not found' };
  }

  if (targetUser.username === 'admin') {
    throw { status: 400, message: 'Cannot delete the Master Admin account.' };
  }

  await run('DELETE FROM users WHERE id = ?', [id]);
  await logAudit('Admin', 'DELETE_USER', `Deleted user account: ${targetUser.username} (${targetUser.name})`);
  return { success: true, message: `User ${targetUser.username} deleted successfully.` };
}
