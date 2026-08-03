/**
 * 将 DB 行的 numeric 字段从 string 转为 number，前端更方便
 */
import type { DbDebt } from './schema.js';
import type { Debt, DebtStatus, Direction, User, UserRole } from '../../shared/types.js';

export function toApiDebt(row: DbDebt): Debt {
  return {
    id: row.id,
    ownerId: row.ownerId,
    partyName: row.partyName,
    direction: row.direction as Direction,
    amount: row.amount,
    paidAmount: row.paidAmount,
    status: row.status as DebtStatus,
    occurredAt: row.occurredAt.toISOString(),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toApiUser(row: {
  id: number;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
}): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}
