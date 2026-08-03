import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { toApiUser } from '../db/serializers.js';
import { getSessionUserId } from '../auth.js';
import { readJson, sendError, sendJson } from '../http.js';
import type { UserRole } from '../../shared/types.js';

async function requireAdmin(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const userId = getSessionUserId(req);
  if (!userId) {
    sendError(res, 401, '未登录');
    return false;
  }
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!rows[0] || rows[0].role !== 'admin') {
    sendError(res, 403, '需要管理员权限');
    return false;
  }
  return true;
}

export async function listUsers(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!(await requireAdmin(req, res))) return;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.id);
  sendJson(res, 200, { users: rows.map(toApiUser) });
}

export async function createUser(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!(await requireAdmin(req, res))) return;
  let body: { username?: string; password?: string; role?: UserRole };
  try {
    body = await readJson(req);
  } catch {
    return sendError(res, 400, '请求体格式错误');
  }
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  const role: UserRole = body.role === 'admin' ? 'admin' : 'user';
  if (username.length < 2 || username.length > 32) {
    return sendError(res, 400, '用户名长度需在 2-32 字符之间');
  }
  if (password.length < 6) {
    return sendError(res, 400, '密码至少 6 位');
  }
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (existing[0]) {
    return sendError(res, 409, '用户名已存在');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [row] = await db
    .insert(users)
    .values({ username, passwordHash, role, active: true })
    .returning();
  sendJson(res, 201, { user: toApiUser(row) });
}

export async function setUserActive(
  req: IncomingMessage,
  res: ServerResponse,
  idStr: string,
  active: boolean
): Promise<void> {
  if (!(await requireAdmin(req, res))) return;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'ID 无效');
  const adminId = getSessionUserId(req);
  if (id === adminId && !active) {
    return sendError(res, 400, '不能禁用自己的账号');
  }
  const [row] = await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!row) return sendError(res, 404, '用户不存在');
  sendJson(res, 200, { user: toApiUser(row) });
}

export async function resetPassword(
  req: IncomingMessage,
  res: ServerResponse,
  idStr: string
): Promise<void> {
  if (!(await requireAdmin(req, res))) return;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'ID 无效');
  let body: { password?: string };
  try {
    body = await readJson(req);
  } catch {
    return sendError(res, 400, '请求体格式错误');
  }
  const password = body.password ?? '';
  if (password.length < 6) {
    return sendError(res, 400, '密码至少 6 位');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [row] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  if (!row) return sendError(res, 404, '用户不存在');
  sendJson(res, 200, { user: toApiUser(row) });
}
