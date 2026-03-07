'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
// Pre-fill credentials for the quick-admin button (set in .env.local for dev)
const ADMIN_LOGIN_PREFILL = process.env.NEXT_PUBLIC_ADMIN_LOGIN || '';
const ADMIN_PASSWORD_PREFILL = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || '';

const MAX_ENV_VAR_DISPLAY_LENGTH = 20;

interface DebugInfo {
  status: string;
  env_vars: Record<string, boolean>;
  missing: string[];
  db: {
    status: string;
    admin_count: number | string;
    seeded: boolean;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  function addLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLog(prev => [...prev, `[${ts}] ${msg}`]);
    console.log('[LoginDebug]', msg);
  }

  const fetchDebugInfo = useCallback(async () => {
    try {
      addLog('Fetching /api/admin/debug …');
      const res = await fetch('/api/admin/debug');
      const data: DebugInfo = await res.json();
      setDebugInfo(data);
      addLog(`Debug: status=${data.status}, db=${data.db.status}, admin_count=${data.db.admin_count}, seeded=${data.db.seeded}`);
      if (data.missing.length > 0) {
        addLog(`⚠ Missing env vars: ${data.missing.join(', ')}`);
      }
      if (!data.db.seeded) {
        addLog('⚠ No admin users in DB! Run: npm run create-admin (or set ADMIN_LOGIN + ADMIN_PASSWORD in Vercel env vars)');
      }
    } catch (err) {
      addLog(`Debug fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  useEffect(() => {
    addLog(`API URL: ${API_URL}`);
    if (isAuthenticated()) {
      addLog('Already authenticated, redirecting to /dashboard');
      router.replace('/dashboard');
      return;
    }
    fetchDebugInfo();
  }, [router, fetchDebugInfo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    addLog(`Attempting login as "${login}" → POST ${API_URL}/api/admin/login`);
    try {
      const res = await api.login(login, password);
      addLog('Login SUCCESS – token received, redirecting to /dashboard');
      setToken(res.access_token);
      router.replace('/dashboard');
    } catch (err: unknown) {
      // Parse the error detail from the server response JSON if possible.
      let msg = err instanceof Error ? err.message : 'Ошибка авторизации';
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.detail) msg = parsed.detail;
      } catch { /* not JSON */ }
      addLog(`Login FAILED: ${msg}`);
      setError(msg);
      // Auto-open debug panel and refresh diagnostics on failure.
      setShowDebug(true);
      fetchDebugInfo();
    } finally {
      setLoading(false);
    }
  }

  function handleAdminLogin() {
    setLogin(ADMIN_LOGIN_PREFILL || 'admin');
    setPassword(ADMIN_PASSWORD_PREFILL);
    addLog('Admin quick-fill applied – press "Войти" to submit');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🔋</div>
          <h1 className="text-2xl font-bold text-gray-900">Rezaryad Admin</h1>
          <p className="text-gray-500 text-sm mt-1">Система управления локерами</p>
          <p className="text-xs text-gray-400 mt-1 font-mono break-all">API: {API_URL}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Имя пользователя</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg break-words">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
          {ADMIN_LOGIN_PREFILL && ADMIN_PASSWORD_PREFILL && (
          <button
            type="button"
            onClick={handleAdminLogin}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            ⚡ Admin Login (тест)
          </button>
          )}
        </form>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDebug(v => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {showDebug ? 'Скрыть' : 'Показать'} отладку
          </button>
          {showDebug && (
            <div className="mt-2 space-y-2">
              {debugInfo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono">
                  <div className="font-semibold text-gray-700 mb-1">Диагностика сервера:</div>
                  <div className={`mb-1 ${debugInfo.status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                    Status: {debugInfo.status}
                  </div>
                  <div className={`mb-1 ${debugInfo.db.seeded ? 'text-green-600' : 'text-red-600'}`}>
                    DB: {debugInfo.db.status} | admin_users: {String(debugInfo.db.admin_count)} rows {debugInfo.db.seeded ? '✓' : '✗ (not seeded!)'}
                  </div>
                  {debugInfo.missing.length > 0 && (
                    <div className="text-orange-600">Missing vars: {debugInfo.missing.join(', ')}</div>
                  )}
                  <div className="mt-1 text-gray-500">
                    {Object.entries(debugInfo.env_vars).map(([k, v]) => (
                      <span key={k} className={`mr-2 ${v ? 'text-green-600' : 'text-red-500'}`}>
                        {v ? '✓' : '✗'}{k.length > MAX_ENV_VAR_DISPLAY_LENGTH ? k.slice(0, MAX_ENV_VAR_DISPLAY_LENGTH) + '…' : k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-gray-900 text-green-400 text-xs font-mono rounded-lg p-3 max-h-40 overflow-y-auto">
                {debugLog.length === 0 ? (
                  <span className="text-gray-500">Нет событий</span>
                ) : (
                  debugLog.map((line, i) => <div key={i}>{line}</div>)
                )}
              </div>
              <button
                type="button"
                onClick={fetchDebugInfo}
                className="text-xs text-blue-500 hover:text-blue-700 underline"
              >
                ↺ Обновить диагностику
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
