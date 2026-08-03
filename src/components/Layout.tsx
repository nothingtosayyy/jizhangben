import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { Text } from '@astryxdesign/core/Text';
import { useAuth } from '../lib/auth';

const navItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'var(--color-text-primary, #1c1e21)',
  fontSize: 14,
  fontWeight: 500,
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-brand">
          <span>债务记账</span>
        </div>
        <nav className="app-header-nav">
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              ...navItemStyle,
              background: isActive ? 'var(--color-background-subtle, #eef0f3)' : 'transparent',
            })}
          >
            总览
          </NavLink>
          <NavLink
            to="/debts"
            style={({ isActive }) => ({
              ...navItemStyle,
              background: isActive ? 'var(--color-background-subtle, #eef0f3)' : 'transparent',
            })}
          >
            债务明细
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              style={({ isActive }) => ({
                ...navItemStyle,
                background: isActive ? 'var(--color-background-subtle, #eef0f3)' : 'transparent',
              })}
            >
              用户管理
            </NavLink>
          )}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text size="sm" color="secondary">
            {user?.username} {user?.role === 'admin' ? '(管理员)' : ''}
          </Text>
          <Button label="退出登录" variant="ghost" size="sm" onClick={handleLogout} />
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
