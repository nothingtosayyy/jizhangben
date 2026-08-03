import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendError } from './http.js';
import * as auth from './routes/auth.js';
import * as debts from './routes/debts.js';
import * as users from './routes/users.js';
import * as stats from './routes/stats.js';
import { ensureAdminUser } from './index.js';

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [
  // auth
  { method: 'POST', pattern: /^\/api\/auth\/login$/, keys: [], handler: auth.handleLogin },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, keys: [], handler: auth.handleLogout },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, keys: [], handler: auth.handleMe },

  // debts
  { method: 'GET', pattern: /^\/api\/debts$/, keys: [], handler: debts.listDebts },
  { method: 'POST', pattern: /^\/api\/debts$/, keys: [], handler: debts.createDebt },
  {
    method: 'PATCH',
    pattern: /^\/api\/debts\/(\d+)$/,
    keys: ['id'],
    handler: (req, res, p) => debts.updateDebt(req, res, p.id),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/debts\/(\d+)$/,
    keys: ['id'],
    handler: (req, res, p) => debts.deleteDebt(req, res, p.id),
  },

  // stats
  { method: 'GET', pattern: /^\/api\/stats$/, keys: [], handler: stats.getStats },

  // users (admin)
  { method: 'GET', pattern: /^\/api\/users$/, keys: [], handler: users.listUsers },
  { method: 'POST', pattern: /^\/api\/users$/, keys: [], handler: users.createUser },
  {
    method: 'POST',
    pattern: /^\/api\/users\/(\d+)\/disable$/,
    keys: ['id'],
    handler: (req, res, p) => users.setUserActive(req, res, p.id, false),
  },
  {
    method: 'POST',
    pattern: /^\/api\/users\/(\d+)\/enable$/,
    keys: ['id'],
    handler: (req, res, p) => users.setUserActive(req, res, p.id, true),
  },
  {
    method: 'POST',
    pattern: /^\/api\/users\/(\d+)\/reset-password$/,
    keys: ['id'],
    handler: (req, res, p) => users.resetPassword(req, res, p.id),
  },

  // health
  { method: 'GET', pattern: /^\/api\/health$/, keys: [], handler: (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
  } },
];

function match(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = m[i + 1]));
    return { route: r, params };
  }
  return null;
}

export function startServer(port = Number(process.env.API_PORT) || 3001): http.Server {
  const server = http.createServer(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      const found = match(req.method ?? 'GET', url.pathname);
      if (!found) {
        return sendError(res, 404, `路由不存在: ${req.method} ${url.pathname}`);
      }
      // 等数据库 bootstrap（pglite）
      const { ready: dbReady } = await import('./db/client.js');
      await dbReady;
      await found.route.handler(req, res, found.params);
    } catch (e) {
      console.error('[server] error:', e);
          if (!res.headersSent) sendError(res, 500, '服务器内部错误');
    }
  });

  // 启动时异步确保 admin 用户存在（不阻塞服务器）
  ensureAdminUser().catch((e) => console.error('[server] ensureAdminUser error:', e));

  server.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });
  return server;
}

const isDirect = import.meta.url === `file:///${process.argv[1]}` ||
  process.argv[1]?.endsWith('api/server.ts') ||
  process.argv[1]?.endsWith('api/server.js');

if (isDirect) {
  startServer();
}
