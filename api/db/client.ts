import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import postgres from 'postgres';
import { PGlite } from '@electric-sql/pglite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
const usePglite = !connectionString || connectionString.startsWith('pglite://');

let _db: ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;
let _bootstrap: Promise<void> | null = null;

if (usePglite) {
  const dataDir = resolve(process.cwd(), '.pglite');
  if (!existsSync(dataDir)) {
    mkdirSync(dirname(dataDir), { recursive: true });
  }
  const pglite = new PGlite(dataDir);
  _db = drizzlePglite(pglite, { schema });

  // 启动时确保 schema 存在（仅在 pglite 模式下由代码控制）
  _bootstrap = (async () => {
    const sql = `
      DO $$ BEGIN
        CREATE TYPE direction AS ENUM ('lend', 'borrow');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE debt_status AS ENUM ('unpaid', 'partial', 'paid');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'user');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'user',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        party_name TEXT NOT NULL,
        direction direction NOT NULL,
        amount NUMERIC(14, 2) NOT NULL,
        paid_amount NUMERIC(14, 2) NOT NULL DEFAULT '0.00',
        status debt_status NOT NULL DEFAULT 'unpaid',
        occurred_at TIMESTAMPTZ NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS debts_owner_id_idx ON debts(owner_id);
      CREATE INDEX IF NOT EXISTS debts_party_name_idx ON debts(party_name);
    `;
    try {
      // 简化：用 pglite 的 exec 接口
      // @ts-ignore
      await pglite.exec(sql);
    } catch (e) {
      console.error('[db] pglite bootstrap error:', e);
    }
  })();
} else {
  const globalForDb = globalThis as unknown as { _pg?: ReturnType<typeof postgres> };
  const client =
    globalForDb._pg ??
    postgres(connectionString!, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  if (process.env.NODE_ENV !== 'production') {
    globalForDb._pg = client;
  }
  _db = drizzlePg(client, { schema });
}

export const db = _db as ReturnType<typeof drizzlePg<typeof schema>>;
export { schema };
export const ready = _bootstrap ?? Promise.resolve();
