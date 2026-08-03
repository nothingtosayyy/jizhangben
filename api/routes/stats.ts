import { eq } from 'drizzle-orm';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from '../db/client.js';
import { debts } from '../db/schema.js';
import { getSessionUserId } from '../auth.js';
import { sendError, sendJson } from '../http.js';
import type { Stats, Direction, DebtStatus } from '../../shared/types.js';
export async function getStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  const rows = await db
    .select()
    .from(debts)
    .where(eq(debts.ownerId, userId));

  let totalLent = 0;
  let totalBorrowed = 0;
  let outstandingLent = 0;
  let outstandingBorrowed = 0;
  const dirMap = new Map<Direction, { total: number; count: number }>();
  const statusMap = new Map<DebtStatus, number>();
  const partyMap = new Map<string, { partyName: string; direction: Direction; total: number; count: number }>();

  for (const r of rows) {
    const amt = Number(r.amount);
    const paid = Number(r.paidAmount);
    const remaining = Math.max(0, amt - paid);
    const dirEntry = dirMap.get(r.direction) ?? { total: 0, count: 0 };
    dirEntry.total += amt;
    dirEntry.count += 1;
    dirMap.set(r.direction, dirEntry);
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
    if (r.direction === 'lend') {
      totalLent += amt;
      outstandingLent += remaining;
    } else {
      totalBorrowed += amt;
      outstandingBorrowed += remaining;
    }
    const key = `${r.direction}::${r.partyName}`;
    const partyEntry = partyMap.get(key) ?? {
      partyName: r.partyName,
      direction: r.direction,
      total: 0,
      count: 0,
    };
    partyEntry.total += remaining;
    partyEntry.count += 1;
    partyMap.set(key, partyEntry);
  }

  const countByDirection = Array.from(dirMap.entries()).map(([direction, v]) => ({
    direction,
    count: v.count,
    total: round2(v.total),
  }));
  const countByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));
  const topParties = Array.from(partyMap.values())
    .map((p) => ({ ...p, total: round2(p.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const stats: Stats = {
    totalLent: round2(totalLent),
    totalBorrowed: round2(totalBorrowed),
    outstandingLent: round2(outstandingLent),
    outstandingBorrowed: round2(outstandingBorrowed),
    net: round2(outstandingLent - outstandingBorrowed),
    countByDirection,
    countByStatus,
    topParties,
  };
  sendJson(res, 200, stats);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
