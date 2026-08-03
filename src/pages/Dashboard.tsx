import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Text } from '@astryxdesign/core/Text';
import { api } from '../lib/api';
import type { Stats, Debt } from '../../shared/types';

function formatAmount(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function directionLabel(d: Debt['direction']): string {
  return d === 'lend' ? '借出' : '借入';
}

function statusLabel(s: Debt['status']): string {
  return s === 'unpaid' ? '未还' : s === 'partial' ? '部分还' : '已还清';
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<Debt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.stats(), api.listDebts()])
      .then(([s, d]) => {
        setStats(s);
        setRecent(d.debts.slice(0, 5));
      })
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'));
  }, []);

  if (error) return <div className="error-banner">{error}</div>;
  if (!stats) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <h1 className="section-title" style={{ marginTop: 0 }}>总览</h1>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">借出总额</div>
          <div className="stat-card-value">¥ {formatAmount(stats.totalLent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">借出未还</div>
          <div className="stat-card-value positive">¥ {formatAmount(stats.outstandingLent)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">借入总额</div>
          <div className="stat-card-value">¥ {formatAmount(stats.totalBorrowed)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">借入未还</div>
          <div className="stat-card-value negative">¥ {formatAmount(stats.outstandingBorrowed)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">净额（应收 - 应付）</div>
          <div className={`stat-card-value ${stats.net >= 0 ? 'positive' : 'negative'}`}>
            ¥ {formatAmount(stats.net)}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        {stats.countByStatus.map((s) => (
          <div className="stat-card" key={s.status}>
            <div className="stat-card-label">{statusLabel(s.status)}</div>
            <div className="stat-card-value">{s.count} 笔</div>
          </div>
        ))}
      </div>

      <h2 className="section-title">最近记录</h2>
      {recent.length === 0 ? (
        <div className="empty-state">
          还没有记录，<Link to="/debts">去添加一条</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>对方</th>
                <th>方向</th>
                <th>金额</th>
                <th>已还</th>
                <th>状态</th>
                <th>日期</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((d) => (
                <tr key={d.id}>
                  <td>{d.partyName}</td>
                  <td>
                    <span className={`tag tag-${d.direction}`}>{directionLabel(d.direction)}</span>
                  </td>
                  <td className="num">¥ {formatAmount(Number(d.amount))}</td>
                  <td className="num">¥ {formatAmount(Number(d.paidAmount))}</td>
                  <td>
                    <span className={`tag tag-${d.status}`}>{statusLabel(d.status)}</span>
                  </td>
                  <td>{new Date(d.occurredAt).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.topParties.length > 0 && (
        <>
          <h2 className="section-title">未还金额 Top 10</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>对方</th>
                  <th>方向</th>
                  <th>笔数</th>
                  <th>未还金额</th>
                </tr>
              </thead>
              <tbody>
                {stats.topParties.map((p, i) => (
                  <tr key={i}>
                    <td>{p.partyName}</td>
                    <td>
                      <span className={`tag tag-${p.direction}`}>{directionLabel(p.direction)}</span>
                    </td>
                    <td>{p.count}</td>
                    <td className="num">¥ {formatAmount(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <Text size="sm" color="secondary">
          数据为本人当前的债务记录，访问时已通过会话校验。
        </Text>
      </div>
    </div>
  );
}
