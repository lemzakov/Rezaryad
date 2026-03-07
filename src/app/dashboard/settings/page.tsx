'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DebugInfo {
  status: string;
  env_vars: Record<string, boolean>;
  missing: string[];
  db: { status: string; admin_count: number | string; seeded: boolean };
}

interface WebhookStatusData {
  success: boolean;
  subscriptions: unknown;
}

export default function SettingsPage() {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [debugLoading, setDebugLoading] = useState(true);
  const [debugError, setDebugError] = useState('');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusData | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    api.getDebugInfo()
      .then(setDebug)
      .catch(e => setDebugError(e.message))
      .finally(() => setDebugLoading(false));

    api.getWebhookStatus()
      .then(setWebhookStatus)
      .catch(() => setWebhookStatus(null));
  }, []);

  async function handleRegisterWebhook(e: React.FormEvent) {
    e.preventDefault();
    setWebhookLoading(true);
    setWebhookResult(null);
    try {
      const result = await api.registerWebhook(webhookUrl);
      if (result.success) {
        setWebhookResult({ success: true, message: 'Webhook успешно зарегистрирован в Max!' });
        const status = await api.getWebhookStatus().catch(() => null);
        if (status) setWebhookStatus(status);
      } else {
        setWebhookResult({ success: false, message: 'Max вернул неожиданный ответ' });
      }
    } catch (err: unknown) {
      setWebhookResult({
        success: false,
        message: err instanceof Error ? err.message : 'Ошибка регистрации webhook',
      });
    } finally {
      setWebhookLoading(false);
    }
  }

  const envItems = debug
    ? Object.entries(debug.env_vars).map(([key, ok]) => ({ key, ok }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Настройки</h1>
        <p className="text-gray-500 text-sm mt-1">Конфигурация системы и интеграции</p>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">🔍 Диагностика системы</h2>

        {debugLoading && <div className="text-gray-400 text-sm">Загрузка...</div>}
        {debugError && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">Ошибка: {debugError}</div>
        )}

        {debug && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  debug.status === 'ok'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {debug.status === 'ok' ? '✓ Всё настроено' : '✗ Требуется настройка'}
              </span>
              <span className="text-sm text-gray-500">
                БД: {debug.db.status === 'ok' ? '✓ Подключена' : `✗ ${debug.db.status}`}
                {typeof debug.db.admin_count === 'number' && ` · Администраторов: ${debug.db.admin_count}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {envItems.map(({ key, ok }) => (
                <div
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${
                    ok
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  <span className="font-bold">{ok ? '✓' : '✗'}</span>
                  <code className="font-mono">{key}</code>
                  <span className="ml-auto text-xs">{ok ? 'Задан' : 'Не задан'}</span>
                </div>
              ))}
            </div>

            {debug.missing.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                <strong>Не заданы обязательные переменные:</strong>{' '}
                {debug.missing.join(', ')}. Добавьте их в переменные окружения Vercel.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Max Messenger Webhook */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">🤖 Max Messenger Webhook</h2>
        <p className="text-gray-500 text-xs mb-4">
          Зарегистрируйте webhook для получения сообщений от бота Max. Backend должен быть доступен публично
          (например, развёрнут на VPS или через ngrok).
        </p>

        {webhookStatus?.success && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Текущие подписки:</strong>
            <pre className="mt-1 text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(webhookStatus.subscriptions, null, 2)}
            </pre>
          </div>
        )}

        <form onSubmit={handleRegisterWebhook} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL webhook (публичный адрес сервера)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://your-domain.com/api/bot/webhook"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              Пример: <code>https://rezaryad.vercel.app/api/bot/webhook</code>
            </p>
          </div>

          {webhookResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                webhookResult.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}
            >
              {webhookResult.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={webhookLoading || !webhookUrl}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {webhookLoading ? 'Регистрация...' : '📡 Зарегистрировать webhook'}
            </button>
            <button
              type="button"
              onClick={() => {
                setWebhookLoading(true);
                api.getWebhookStatus()
                  .then(s => setWebhookStatus(s))
                  .catch(() => setWebhookStatus(null))
                  .finally(() => setWebhookLoading(false));
              }}
              disabled={webhookLoading}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              🔄 Проверить статус
            </button>
          </div>
        </form>

        <div className="mt-5 border-t pt-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Зарегистрировать вручную через curl:</p>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs overflow-auto whitespace-pre-wrap text-gray-700">
{`curl -X POST "https://botapi.max.ru/subscriptions?access_token=<MAX_BOT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "${webhookUrl || 'https://<your-host>/api/bot/webhook'}",
    "update_types": ["message_created", "message_callback"]
  }'`}
          </pre>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-blue-500">
          <div className="text-2xl mb-2">📚</div>
          <h3 className="font-semibold text-gray-900 text-sm">Документация</h3>
          <p className="text-xs text-gray-500 mt-1">
            Инструкции по настройке в{' '}
            <a
              href="https://github.com/lemzakov/Rezaryad/blob/main/README.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              README.md
            </a>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-green-500">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="font-semibold text-gray-900 text-sm">Max Developer Portal</h3>
          <p className="text-xs text-gray-500 mt-1">
            Получите токен бота на{' '}
            <a
              href="https://dev.max.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              dev.max.ru
            </a>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-purple-500">
          <div className="text-2xl mb-2">🔗</div>
          <h3 className="font-semibold text-gray-900 text-sm">ngrok (для разработки)</h3>
          <p className="text-xs text-gray-500 mt-1">
            Экспонируйте локальный сервер через{' '}
            <a
              href="https://ngrok.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              ngrok.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
