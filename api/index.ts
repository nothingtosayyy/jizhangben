import http from 'node:http';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, ready } from './db/client.js';
import { users } from './db/schema.js';

const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';

export async function ensureAdminUser(): Promise<void> {
  try {
    await ready;
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, DEFAULT_ADMIN_USERNAME))
      .limit(1);
    if (rows[0]) {
      console.log(`[seed] admin user "${DEFAULT_ADMIN_USERNAME}" already exists`);
      return;
    }
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await db.insert(users).values({
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      role: 'admin',
      active: true,
    });
    console.log(
      `[seed] created admin user "${DEFAULT_ADMIN_USERNAME}" with default password (please change it after first login)`
    );
  } catch (e) {
    console.error('[seed] failed to ensure admin user:', e);
  }
}

// 当直接执行此文件时启动服务器
const isDirect = import.meta.url === `file:///${process.argv[1]}` ||
  process.argv[1]?.endsWith('api/index.ts') ||
  process.argv[1]?.endsWith('api/index.js');

if (isDirect) {
  // 动态导入避免循环引用
  const mod = await import('./server.js');
  await ensureAdminUser();
  mod.startServer();
}
