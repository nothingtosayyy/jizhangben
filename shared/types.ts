// 纯类型定义：前端和后端共享
// 不依赖 drizzle 运行时代码

export type Direction = 'lend' | 'borrow';
export type DebtStatus = 'unpaid' | 'partial' | 'paid';
export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Debt {
  id: number;
  ownerId: number;
  partyName: string;
  direction: Direction;
  amount: string; // numeric 序列化为字符串
  paidAmount: string;
  status: DebtStatus;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
}

export interface Stats {
  totalLent: number;        // 借出总额（原始金额）
  totalBorrowed: number;    // 借入总额
  outstandingLent: number;  // 借出未还金额
  outstandingBorrowed: number; // 借入未还金额
  net: number;              // 净额（借出未还 - 借入未还）
  countByDirection: { direction: Direction; count: number; total: number }[];
  countByStatus: { status: DebtStatus; count: number }[];
  topParties: { partyName: string; direction: Direction; total: number; count: number }[];
}

export interface ApiError {
  error: string;
}
