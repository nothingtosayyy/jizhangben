/**
 * Vercel Function (catch-all)
 * 接收 Web Request，转发到与开发期共用 handlers，返回 Web Response。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';
import * as auth from './routes/auth.js';
import * as debts from './routes/debts.js';
import * as users from './routes/users.js';
import * as stats from './routes/stats.js';
import { ensureAdminUser } from './index.js';

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
) => void | Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

const routes: Route[] = [
  { method: 'POST', pattern: /^\/api\/auth\/login$/, keys: [], handler: auth.handleLogin },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/, keys: [], handler: auth.handleLogout },
  { method: 'GET', pattern: /^\/api\/auth\/me$/, keys: [], handler: auth.handleMe },
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
  { method: 'GET', pattern: /^\/api\/stats$/, keys: [], handler: stats.getStats },
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

// 在容器启动时确保 admin 用户存在（首次部署 / 冷启动）
let ensured: Promise<void> | null = null;
function ensureReady() {
  if (!ensured) ensured = ensureAdminUser().catch(() => undefined);
  return ensured;
}

export default async function handler(request: Request): Promise<Response> {
  await ensureReady();
  // 等数据库 bootstrap（pglite）
  const { ready: dbReady } = await import('./db/client.js');
  await dbReady;
  const url = new URL(request.url);
  const found = match(request.method, url.pathname);
  if (!found) {
    return new Response(
      JSON.stringify({ error: `路由不存在: ${request.method} ${url.pathname}` }),
      { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  // 构造 IncomingMessage 和 ServerResponse 适配 Web Request/Response
  const { req, res, finalize } = createNodeLike(request);

  try {
    await found.route.handler(req as IncomingMessage, res as unknown as ServerResponse, found.params);
  } catch (e) {
    console.error('[vercel-fn] error:', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: '服务器内部错误' }));
    }
  }

  return finalize();
}

function createNodeLike(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  const url = new URL(request.url);
  const req = new PassThrough() as unknown as IncomingMessage;
  (req as unknown as { method: string }).method = request.method;
  (req as unknown as { url: string }).url = url.pathname + url.search;
  (req as unknown as { headers: Record<string, string> }).headers = headers;

  // 写入 body（如果有）
  if (request.body) {
    const reader = request.body.getReader();
    const pump = async () => {
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) (req as unknown as PassThrough).write(Buffer.from(value));
      }
      (req as unknown as PassThrough).end();
    };
    // 不 await, request 数据会异步流入
    void pump();
  } else {
    setImmediate(() => (req as unknown as PassThrough).end());
  }

  let statusCode = 200;
  const resHeaders: Record<string, string> = {};
  const resChunks: Buffer[] = [];
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string | number | string[]) {
      resHeaders[name.toLowerCase()] = String(value);
    },
    getHeader(name: string) {
      return resHeaders[name.toLowerCase()];
    },
    removeHeader(name: string) {
      delete resHeaders[name.toLowerCase()];
    },
    write(chunk: string | Buffer | Uint8Array) {
      resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    },
    end(chunk?: string | Buffer | Uint8Array) {
      if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      this.headersSent = true;
    },
  };

  Object.defineProperty(res, 'statusCode', {
    get() { return statusCode; },
    set(v: number) { statusCode = v; },
  });

  const finalize = async (): Promise<Response> => {
    // 等数据流完成
    if (!(req as unknown as PassThrough).readableEnded) {
      await new Promise<void>((resolve) => req.on('end', () => resolve()));
    }
    const body = Buffer.concat(resChunks);
    const respHeaders = new Headers();
    for (const [k, v] of Object.entries(resHeaders)) {
      // 跳过 set-cookie 由 Response 自己处理（下面单独处理）
      if (k.toLowerCase() === 'set-cookie') continue;
      respHeaders.set(k, v);
    }
    const setCookieRaw = resHeaders['set-cookie'];
    if (setCookieRaw) {
      // 支持多 cookie：node 会用数组，这里我们已经合并成 string
      respHeaders.append('set-cookie', setCookieRaw);
    }
    return new Response(body, { status: statusCode, headers: respHeaders });
  };

  return { req, res, finalize };
}

export const config = {
  runtime: 'nodejs20.x',
};
