import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { User, UserRole } from '../../shared/types';

function formatDate(s: string): string {
  return new Date(s).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resetFor, setResetFor] = useState<User | null>(null);
  const [newPw, setNewPw] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const { users } = await api.listUsers();
      setUsers(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (me && me.role !== 'admin') return <Navigate to="/" replace />;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      setShowCreate(false);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      await refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    try {
      await api.setActive(u.id, !u.active);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败');
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetFor) return;
    try {
      await api.resetPassword(resetFor.id, newPw);
      setResetFor(null);
      setNewPw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '重置失败');
    }
  };

  return (
    <div>
      <h1 className="section-title" style={{ marginTop: 0 }}>用户管理</h1>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <Button label="新增用户" variant="primary" onClick={() => setShowCreate(true)} />
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">加载中...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>用户名</th>
                <th>角色</th>
                <th>状态</th>
                <th>创建时间</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}{me?.id === u.id ? ' (我)' : ''}</td>
                  <td>
                    <span className={`tag ${u.role === 'admin' ? 'tag-lend' : 'tag-paid'}`}>
                      {u.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td>
                    {u.active ? (
                      <span className="tag tag-lend">启用</span>
                    ) : (
                      <span className="tag tag-inactive">已禁用</span>
                    )}
                  </td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        label={u.active ? '禁用' : '启用'}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleToggleActive(u)}
                      />
                      <Button
                        label="重置密码"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResetFor(u);
                          setNewPw('');
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => !submitting && setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">新增用户</div>
            <form onSubmit={handleCreate} className="modal-body">
              {createError && <div className="error-banner">{createError}</div>}
              <div className="field-row">
                <label>用户名</label>
                <input
                  className="text-input"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="2-32 字符"
                  autoFocus
                />
              </div>
              <div className="field-row">
                <label>初始密码（至少 6 位）</label>
                <input
                  className="text-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="field-row">
                <label>角色</label>
                <select
                  className="text-input"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value="user">普通用户</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <div className="modal-footer">
                <Button label="取消" variant="secondary" onClick={() => setShowCreate(false)} isDisabled={submitting} />
                <Button type="submit" label="创建" variant="primary" isLoading={submitting} isDisabled={submitting} />
              </div>
            </form>
          </div>
        </div>
      )}

      {resetFor && (
        <div className="modal-backdrop" onClick={() => setResetFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">重置 {resetFor.username} 的密码</div>
            <form onSubmit={handleResetPassword} className="modal-body">
              <div className="field-row">
                <label>新密码（至少 6 位）</label>
                <input
                  className="text-input"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <Button label="取消" variant="secondary" onClick={() => setResetFor(null)} />
                <Button type="submit" label="保存" variant="primary" />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
