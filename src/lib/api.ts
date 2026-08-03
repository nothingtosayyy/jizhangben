import type { Debt, Stats, User, AuthSession } from '../../shared/types';

const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`响应不是合法 JSON: ${text.slice(0, 80)}`);
    }
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  // auth
  login: (username: string, password: string) =>
    request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<AuthSession>('/auth/me'),

  // debts
  listDebts: (params: { q?: string; direction?: 'lend' | 'borrow'; status?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.direction) search.set('direction', params.direction);
    if (params.status) search.set('status', params.status);
    const qs = search.toString();
    return request<{ debts: Debt[] }>(`/debts${qs ? `?${qs}` : ''}`);
  },
  createDebt: (data: {
    partyName: string;
    direction: 'lend' | 'borrow';
    amount: number;
    paidAmount?: number;
    status?: 'unpaid' | 'partial' | 'paid';
    occurredAt: string;
    note?: string;
  }) => request<{ debt: Debt }>('/debts', { method: 'POST', body: JSON.stringify(data) }),
  updateDebt: (
    id: number,
    data: Partial<{
      partyName: string;
      direction: 'lend' | 'borrow';
      amount: number;
      paidAmount: number;
      status: 'unpaid' | 'partial' | 'paid';
      occurredAt: string;
      note: string | null;
    }>
  ) => request<{ debt: Debt }>(`/debts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteDebt: (id: number) => request<{ ok: true }>(`/debts/${id}`, { method: 'DELETE' }),

  // stats
  stats: () => request<Stats>('/stats'),

  // users
  listUsers: () => request<{ users: User[] }>('/users'),
  createUser: (data: { username: string; password: string; role?: 'admin' | 'user' }) =>
    request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }),
  setActive: (id: number, active: boolean) =>
    request<{ user: User }>(`/users/${id}/${active ? 'enable' : 'disable'}`, { method: 'POST' }),
  resetPassword: (id: number, password: string) =>
    request<{ user: User }>(`/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};
