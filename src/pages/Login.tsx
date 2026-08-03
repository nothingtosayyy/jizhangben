import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>债务记账</h1>
        <div className="subtitle">请登录后开始使用</div>
        {error && <div className="error-banner">{error}</div>}
        <div className="astryx-field-wrap">
          <TextInput
            label="用户名"
            value={username}
            onChange={setUsername}
            placeholder="请输入用户名"
            hasAutoFocus
            width="100%"
          />
        </div>
        <div className="astryx-field-wrap">
          <TextInput
            type="password"
            label="密码"
            value={password}
            onChange={setPassword}
            placeholder="请输入密码"
            width="100%"
          />
        </div>
        <Button
          type="submit"
          label={submitting ? '登录中...' : '登录'}
          variant="primary"
          isDisabled={submitting}
          isLoading={submitting}
          width="100%"
        />
      </form>
    </div>
  );
}
