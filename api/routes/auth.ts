import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { toApiUser } from '../db/serializers.js';
import {
  clearSessionCookie,
  getSessionUserId,
  setSessionCookie,
} from '../auth.js';
import { readJson, sendError, sendJson } from '../http.js';

export async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { username?: string; password?: string };
  try {
    body = await readJson<{ username?: string; password?: string }>(req);
  } catch {
    return sendError(res, 400, '请求体格式错误');
  }
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';
  if (!username || !password) {
    return sendError(res, 400, '用户名和密码不能为空');
  }
  try {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = rows[0];
    if (!user || !user.active) {
      return sendError(res, 401, '用户名或密码错误');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return sendError(res, 401, '用户名或密码错误');
    }
    setSessionCookie(res, user.id);
    sendJson(res, 200, { user: toApiUser(user) });
  } catch (e) {
    console.error('[login]', e);
    sendError(res, 500, '登录失败');
  }
}

export async function handleLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
}

export async function handleMe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    clearSessionCookie(res);
    return sendError(res, 401, '账号不存在');
  }
  sendJson(res, 200, { user: toApiUser(user) });
}
