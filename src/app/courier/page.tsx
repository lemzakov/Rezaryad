'use client';
import { useEffect, useRef, useState } from 'react';

type AppState =
  | 'loading'        // detecting MAX WebApp context
  | 'no_context'     // opened outside MAX messenger
  | 'form'           // show registration form
  | 'submitting'     // sending registration request
  | 'pending'        // registration submitted, waiting for approval
  | 'already_active' // courier is already approved
  | 'error';         // unexpected error

// MAX/Telegram WebApp SDK type (minimal)
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        MainButton?: {
          setText: (t: string) => void;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
        };
      };
    };
  }
}

export default function CourierApp() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [initData, setInitData] = useState<string>('');
  const [maxId, setMaxId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const logs: string[] = [];
    const addLog = (msg: string) => {
      console.log('[CourierApp]', msg);
      logs.push(msg);
    };

    addLog(`Page loaded at ${new Date().toISOString()}`);
    addLog(`URL: ${window.location.href}`);

    function tryInitSdk(attempt: number) {
      if (resolvedRef.current) return;

      const hasTelegram = typeof window.Telegram !== 'undefined';
      const hasWebApp = hasTelegram && typeof window.Telegram?.WebApp !== 'undefined';
      const tg = window.Telegram?.WebApp;
      const hasInitData = !!(tg?.initData);

      addLog(`Attempt ${attempt}: window.Telegram=${hasTelegram}, WebApp=${hasWebApp}, initData=${hasInitData}`);

      if (hasInitData && tg) {
        resolvedRef.current = true;
        addLog('MAX WebApp context detected — initializing');
        if (typeof tg.ready === 'function') tg.ready();
        if (typeof tg.expand === 'function') tg.expand();

        setInitData(tg.initData!);

        const user = tg.initDataUnsafe?.user;
        if (user) {
          const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
          addLog(`SDK user: id=${user.id}, name="${fullName}"`);
          setName(fullName);
          setMaxId(String(user.id ?? ''));
        } else {
          addLog('No user object in initDataUnsafe');
        }

        setDebugInfo([...logs]);
        setAppState('form');
        return true;
      }

      return false;
    }

    // Attempt 1: immediately
    if (tryInitSdk(1)) return;

    // Attempts 2–4: retry with increasing delays (MAX SDK may load asynchronously)
    const delays = [200, 500, 1000];
    const timers: ReturnType<typeof setTimeout>[] = [];

    delays.forEach((delay, i) => {
      timers.push(
        setTimeout(() => {
          if (resolvedRef.current) return;
          if (tryInitSdk(i + 2)) return;

          // After the last retry, give up and show no_context
          if (i === delays.length - 1) {
            resolvedRef.current = true;
            addLog('SDK not found after all retries — showing no_context');
            // Log available window keys that might be SDK-related
            const sdkKeys = Object.keys(window).filter(
              (k) => /telegram|webapp|max|vk|twa/i.test(k)
            );
            addLog(`SDK-like window keys: [${sdkKeys.join(', ') || 'none'}]`);
            setDebugInfo([...logs]);
            setAppState('no_context');
          }
        }, delay)
      );
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMsg('Введите ваше имя (минимум 2 символа)');
      return;
    }

    setAppState('submitting');
    setErrorMsg('');
    console.log('[CourierApp] Submitting registration:', { name: trimmedName, hasInitData: !!initData });

    try {
      const res = await fetch('/api/couriers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, name: trimmedName }),
      });

      const data = await res.json();
      console.log('[CourierApp] Registration response:', res.status, data);

      if (!res.ok) {
        setErrorMsg(data.detail || 'Ошибка при регистрации');
        setAppState('form');
        return;
      }

      if (data.status === 'ACTIVE') {
        setStatusMsg(data.message || 'Профиль обновлён');
        setAppState('already_active');
      } else {
        setStatusMsg(data.message || 'Заявка отправлена');
        setAppState('pending');
      }
    } catch (e) {
      setErrorMsg('Ошибка сети. Попробуйте ещё раз.');
      setAppState('form');
      console.error('[CourierApp] Registration error:', e);
    }
  }

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (appState === 'no_context') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📱</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Приложение для курьеров</h1>
          <p className="text-gray-500 text-sm mb-6">
            Это приложение предназначено для открытия внутри мессенджера MAX.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">Как открыть:</p>
            <ol className="text-left space-y-1 list-decimal list-inside">
              <li>Откройте мессенджер MAX</li>
              <li>Найдите бота Rezaryad</li>
              <li>Нажмите кнопку «Открыть приложение»</li>
            </ol>
          </div>
          {debugInfo.length > 0 && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                🔍 Диагностика (для разработчика)
              </summary>
              <div className="mt-2 bg-gray-900 rounded-xl p-3 text-xs font-mono text-green-400 space-y-1 overflow-auto max-h-48">
                {debugInfo.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </details>
          )}
          <p className="mt-4 text-xs text-gray-400">
            Если вы разработчик, откройте эту страницу через mini-app в MAX для тестирования.
          </p>
        </div>
      </div>
    );
  }

  if (appState === 'pending') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Заявка отправлена!</h1>
          <p className="text-gray-500 text-sm mb-4">{statusMsg}</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            <p>Администратор рассмотрит вашу заявку и подтвердит регистрацию. После одобрения вы получите уведомление.</p>
          </div>
          {maxId && (
            <p className="mt-4 text-xs text-gray-400">
              Ваш MAX ID: <span className="font-mono font-bold">{maxId}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (appState === 'already_active') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Вы уже зарегистрированы!</h1>
          <p className="text-gray-500 text-sm">{statusMsg}</p>
          {maxId && (
            <p className="mt-4 text-xs text-gray-400">
              MAX ID: <span className="font-mono font-bold">{maxId}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (appState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-gray-500 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={() => { setAppState('form'); setErrorMsg(''); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  // Form state (and submitting)
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      <div className="flex-1 flex items-start justify-center p-6 pt-10">
        <div className="max-w-sm w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🚴</div>
            <h1 className="text-2xl font-bold text-gray-900">Регистрация курьера</h1>
            <p className="text-gray-500 text-sm mt-1">Rezaryad — аренда ячеек для курьеров</p>
          </div>

          {/* MAX ID info */}
          {maxId && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Ваш MAX ID</p>
              <p className="text-lg font-mono font-bold text-blue-900">{maxId}</p>
            </div>
          )}

          {/* Registration form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Ваше имя <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Введите ваше имя"
                required
                minLength={2}
                maxLength={100}
                disabled={appState === 'submitting'}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                Имя будет отображаться в системе для администратора
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={appState === 'submitting' || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl text-base transition-colors"
            >
              {appState === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Отправка...
                </span>
              ) : (
                '📋 Подать заявку на регистрацию'
              )}
            </button>

            <p className="text-xs text-gray-400 text-center">
              После отправки заявки администратор проверит её и активирует ваш аккаунт.
              Вы получите уведомление в MAX.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
