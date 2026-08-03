import { and, desc, eq, ilike, type SQL } from 'drizzle-orm';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { db } from '../db/client.js';
import { debts } from '../db/schema.js';
import { toApiDebt } from '../db/serializers.js';
import { getSessionUserId } from '../auth.js';
import { readJson, sendError, sendJson } from '../http.js';
import type { Debt, DebtStatus, Direction } from '../../shared/types.js';

interface DebtInput {
  partyName?: string;
  direction?: Direction;
  amount?: number | string;
  paidAmount?: number | string;
  status?: DebtStatus;
  occurredAt?: string;
  note?: string | null;
}

function validateDebt(input: DebtInput, partial = false): DebtInput | string {
  if (!partial || input.partyName !== undefined) {
    if (!input.partyName || !input.partyName.trim()) return '对方名称不能为空';
  }
  if (!partial || input.direction !== undefined) {
    if (input.direction !== 'lend' && input.direction !== 'borrow') return '方向必须是 lend 或 borrow';
  }
  if (!partial || input.amount !== undefined) {
    const amt = Number(input.amount);
    if (!isFinite(amt) || amt < 0) return '金额无效';
  }
  if (input.paidAmount !== undefined) {
    const paid = Number(input.paidAmount);
    if (!isFinite(paid) || paid < 0) return '已还金额无效';
  }
  if (input.status !== undefined) {
    if (!['unpaid', 'partial', 'paid'].includes(input.status)) return '状态无效';
  }
  if (!partial || input.occurredAt !== undefined) {
    if (!input.occurredAt || isNaN(Date.parse(input.occurredAt))) return '日期无效';
  }
  return input;
}

export async function listDebts(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  const url = new URL(req.url ?? '/', 'http://localhost');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const dir = url.searchParams.get('direction') as Direction | null;
  const status = url.searchParams.get('status') as DebtStatus | null;
  const conditions: SQL[] = [eq(debts.ownerId, userId)];
  if (q) conditions.push(ilike(debts.partyName, `%${q}%`));
  if (dir === 'lend' || dir === 'borrow') conditions.push(eq(debts.direction, dir));
  if (status === 'unpaid' || status === 'partial' || status === 'paid') {
    conditions.push(eq(debts.status, status));
  }
  const rows = await db
    .select()
    .from(debts)
    .where(and(...conditions))
    .orderBy(desc(debts.occurredAt), desc(debts.id));
  sendJson(res, 200, { debts: rows.map(toApiDebt) });
}

export async function createDebt(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  let body: DebtInput;
  try {
    body = await readJson<DebtInput>(req);
  } catch {
    return sendError(res, 400, '请求体格式错误');
  }
  const validated = validateDebt(body);
  if (typeof validated === 'string') return sendError(res, 400, validated);
  const amount = String(Number(validated.amount).toFixed(2));
  const paidAmount = validated.paidAmount !== undefined
    ? String(Number(validated.paidAmount).toFixed(2))
    : '0.00';
  const status = computeStatus(amount, paidAmount, validated.status);
  const [row] = await db
    .insert(debts)
    .values({
      ownerId: userId,
      partyName: validated.partyName!.trim(),
      direction: validated.direction!,
      amount,
      paidAmount,
      status,
      occurredAt: new Date(validated.occurredAt!),
      note: validated.note ?? null,
    })
    .returning();
  sendJson(res, 201, { debt: toApiDebt(row) });
}

export async function updateDebt(
  req: IncomingMessage,
  res: ServerResponse,
  idStr: string
): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'ID 无效');
  let body: DebtInput;
  try {
    body = await readJson<DebtInput>(req);
  } catch {
    return sendError(res, 400, '请求体格式错误');
  }
  const validated = validateDebt(body, true);
  if (typeof validated === 'string') return sendError(res, 400, validated);
  const existing = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.ownerId, userId)))
    .limit(1);
  if (!existing[0]) return sendError(res, 404, '记录不存在');
  const amount = validated.amount !== undefined ? String(Number(validated.amount).toFixed(2)) : existing[0].amount;
  const paidAmount = validated.paidAmount !== undefined
    ? String(Number(validated.paidAmount).toFixed(2))
    : existing[0].paidAmount;
  const status = computeStatus(amount, paidAmount, validated.status);
  const [row] = await db
    .update(debts)
    .set({
      partyName: validated.partyName?.trim() ?? existing[0].partyName,
      direction: validated.direction ?? existing[0].direction,
      amount,
      paidAmount,
      status,
      occurredAt: validated.occurredAt ? new Date(validated.occurredAt) : existing[0].occurredAt,
      note: validated.note !== undefined ? validated.note : existing[0].note,
      updatedAt: new Date(),
    })
    .where(and(eq(debts.id, id), eq(debts.ownerId, userId)))
    .returning();
  sendJson(res, 200, { debt: toApiDebt(row) });
}

export async function deleteDebt(
  req: IncomingMessage,
  res: ServerResponse,
  idStr: string
): Promise<void> {
  const userId = getSessionUserId(req);
  if (!userId) return sendError(res, 401, '未登录');
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, 'ID 无效');
  const [row] = await db
    .delete(debts)
    .where(and(eq(debts.id, id), eq(debts.ownerId, userId)))
    .returning();
  if (!row) return sendError(res, 404, '记录不存在');
  sendJson(res, 200, { ok: true });
}

function computeStatus(amount: string, paidAmount: string, hint?: DebtStatus): DebtStatus {
  if (hint === 'paid' || hint === 'unpaid' || hint === 'partial') return hint;
  const a = Number(amount);
  const p = Number(paidAmount);
  if (p <= 0) return 'unpaid';
  if (p >= a) return 'paid';
  return 'partial';
}
