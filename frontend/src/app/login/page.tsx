'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { setToken, isAuthenticated } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  function addLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    setDebugLog(prev => [...prev, `[${ts}] ${msg}`]);
    console.log('[LoginDebug]', msg);
  }

  useEffect(() => {
    addLog(`API URL: ${API_URL}`);
    if (isAuthenticated()) {
      addLog('Already authenticated, redirecting to /dashboard');
      router.replace('/dashboard');
    }
  }, [router]);

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
      const msg = err instanceof Error ? err.message : 'Ошибка авторизации';
      addLog(`Login FAILED: ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleAdminLogin() {
    setLogin('admin');
    setPassword(process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD || 'admin');
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
          <button
            type="button"
            onClick={handleAdminLogin}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            ⚡ Admin Login (тест)
          </button>
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
            <div className="mt-2 bg-gray-900 text-green-400 text-xs font-mono rounded-lg p-3 max-h-40 overflow-y-auto">
              {debugLog.length === 0 ? (
                <span className="text-gray-500">Нет событий</span>
              ) : (
                debugLog.map((line, i) => <div key={i}>{line}</div>)
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
