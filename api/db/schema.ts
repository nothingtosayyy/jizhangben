import { sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';

// 方向：借出（别人欠我）/ 借入（我欠别人）
export const directionEnum = pgEnum('direction', ['lend', 'borrow']);
// 状态：未还 / 部分还 / 已还清
export const statusEnum = pgEnum('debt_status', ['unpaid', 'partial', 'paid']);
// 角色
export const roleEnum = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull().default('user'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const debts = pgTable('debts', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  partyName: text('party_name').notNull(),
  direction: directionEnum('direction').notNull(),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  status: statusEnum('status').notNull().default('unpaid'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DbUser = typeof users.$inferSelect;
export type DbDebt = typeof debts.$inferSelect;

// 引用 sql 防止 tree-shake 警告
void sql;
