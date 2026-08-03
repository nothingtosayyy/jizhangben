import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { api } from '../lib/api';
import type { Debt, DebtStatus, Direction } from '../../shared/types';

function formatAmount(n: number | string): string {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function directionLabel(d: Direction): string {
  return d === 'lend' ? '借出' : '借入';
}

function statusLabel(s: DebtStatus): string {
  return s === 'unpaid' ? '未还' : s === 'partial' ? '部分还' : '已还清';
}

interface FormState {
  partyName: string;
  direction: Direction;
  amount: string;
  paidAmount: string;
  occurredAt: string; // YYYY-MM-DD
  note: string;
}

const emptyForm: FormState = {
  partyName: '',
  direction: 'lend',
  amount: '',
  paidAmount: '0',
  occurredAt: new Date().toISOString().slice(0, 10),
  note: '',
};

export default function Debts() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [dirFilter, setDirFilter] = useState<'' | Direction>('');
  const [statusFilter, setStatusFilter] = useState<'' | DebtStatus>('');

  const [editing, setEditing] = useState<Debt | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const params: { q?: string; direction?: Direction; status?: DebtStatus } = {};
      if (q.trim()) params.q = q.trim();
      if (dirFilter) params.direction = dirFilter;
      if (statusFilter) params.status = statusFilter;
      const { debts } = await api.listDebts(params);
      setDebts(debts);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSubmitError(null);
    setShowForm(true);
  };

  const openEdit = (d: Debt) => {
    setEditing(d);
    setForm({
      partyName: d.partyName,
      direction: d.direction,
      amount: d.amount,
      paidAmount: d.paidAmount,
      occurredAt: d.occurredAt.slice(0, 10),
      note: d.note ?? '',
    });
    setSubmitError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const amount = Number(form.amount);
    if (!form.partyName.trim()) {
      setSubmitError('请输入对方名称');
      return;
    }
    if (!isFinite(amount) || amount <= 0) {
      setSubmitError('请输入有效金额');
      return;
    }
    const paid = Number(form.paidAmount || 0);
    if (!isFinite(paid) || paid < 0) {
      setSubmitError('已还金额无效');
      return;
    }
    if (paid > amount + 0.0001) {
      setSubmitError('已还金额不能大于金额');
      return;
    }
    setSubmitting(true);
    try {
      const occurredAt = new Date(form.occurredAt + 'T00:00:00').toISOString();
      if (editing) {
        await api.updateDebt(editing.id, {
          partyName: form.partyName.trim(),
          direction: form.direction,
          amount,
          paidAmount: paid,
          occurredAt,
          note: form.note.trim() || null,
        });
      } else {
        await api.createDebt({
          partyName: form.partyName.trim(),
          direction: form.direction,
          amount,
          paidAmount: paid,
          occurredAt,
          note: form.note.trim() || undefined,
        });
      }
      setShowForm(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (d: Debt) => {
    if (!window.confirm(`确认删除「${d.partyName}」的记录？此操作不可撤销。`)) return;
    try {
      await api.deleteDebt(d.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <div>
      <h1 className="section-title" style={{ marginTop: 0 }}>债务明细</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <input
          className="text-input"
          placeholder="按对方名称搜索"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && refresh()}
          style={{ minWidth: 200 }}
        />
        <select
          className="text-input"
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value as '' | Direction)}
        >
          <option value="">全部方向</option>
          <option value="lend">借出</option>
          <option value="borrow">借入</option>
        </select>
        <select
          className="text-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | DebtStatus)}
        >
          <option value="">全部状态</option>
          <option value="unpaid">未还</option>
          <option value="partial">部分还</option>
          <option value="paid">已还清</option>
        </select>
        <Button label="搜索" variant="secondary" onClick={refresh} />
        <div style={{ flex: 1 }} />
        <Button label="新增记录" variant="primary" onClick={openCreate} />
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : debts.length === 0 ? (
          <div className="empty-state">暂无记录</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>对方</th>
                <th>方向</th>
                <th>金额</th>
                <th>已还</th>
                <th>未还</th>
                <th>状态</th>
                <th>日期</th>
                <th>备注</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => {
                const remaining = Math.max(0, Number(d.amount) - Number(d.paidAmount));
                return (
                  <tr key={d.id}>
                    <td>{d.partyName}</td>
                    <td>
                      <span className={`tag tag-${d.direction}`}>{directionLabel(d.direction)}</span>
                    </td>
                    <td className="num">¥ {formatAmount(d.amount)}</td>
                    <td className="num">¥ {formatAmount(d.paidAmount)}</td>
                    <td className="num">¥ {formatAmount(remaining)}</td>
                    <td>
                      <span className={`tag tag-${d.status}`}>{statusLabel(d.status)}</span>
                    </td>
                    <td>{new Date(d.occurredAt).toLocaleDateString('zh-CN')}</td>
                    <td style={{ color: 'var(--color-text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.note || '—'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button label="编辑" variant="ghost" size="sm" onClick={() => openEdit(d)} />
                        <Button label="删除" variant="destructive" size="sm" onClick={() => handleDelete(d)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">{editing ? '编辑债务' : '新增债务'}</div>
            <form onSubmit={handleSubmit} className="modal-body">
              {submitError && <div className="error-banner">{submitError}</div>}
              <div className="field-row">
                <label>对方名称</label>
                <input
                  className="text-input"
                  value={form.partyName}
                  onChange={(e) => setForm({ ...form, partyName: e.target.value })}
                  placeholder="例如：张三 / 招商银行"
                  autoFocus
                />
              </div>
              <div className="field-row">
                <label>方向</label>
                <select
                  className="text-input"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })}
                >
                  <option value="lend">借出（别人欠我）</option>
                  <option value="borrow">借入（我欠别人）</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field-row">
                  <label>金额</label>
                  <input
                    className="text-input"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div className="field-row">
                  <label>已还金额</label>
                  <input
                    className="text-input"
                    value={form.paidAmount}
                    onChange={(e) => setForm({ ...form, paidAmount: e.target.value.replace(/[^\d.]/g, '') })}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>
              <div className="field-row">
                <label>借款日期</label>
                <input
                  className="text-input"
                  type="date"
                  value={form.occurredAt}
                  onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                />
              </div>
              <div className="field-row">
                <label>备注</label>
                <textarea
                  className="text-input"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="可选"
                  rows={3}
                />
              </div>
              <div className="modal-footer">
                <Button label="取消" variant="secondary" onClick={closeForm} isDisabled={submitting} />
                <Button
                  type="submit"
                  label={editing ? '保存' : '创建'}
                  variant="primary"
                  isDisabled={submitting}
                  isLoading={submitting}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
