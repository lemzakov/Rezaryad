'use client';
import { useEffect, useRef, useState } from 'react';
import { api, MaxDebugData, MaxMessage, MaxSubscriberInfo } from '@/lib/api';

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function SettingsPage() {
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [debugLoading, setDebugLoading] = useState(true);
  const [debugError, setDebugError] = useState('');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatusData | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  // MAX Debug section
  const [maxData, setMaxData] = useState<MaxDebugData | null>(null);
  const [maxLoading, setMaxLoading] = useState(false);
  const [maxError, setMaxError] = useState('');
  const [selectedSubscriber, setSelectedSubscriber] = useState<MaxSubscriberInfo | null>(null);
  const [sendTarget, setSendTarget] = useState('');
  const [sendText, setSendText] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'webhook' | 'debug'>('webhook');
  const [liveMode, setLiveMode] = useState(false);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.getDebugInfo()
      .then(setDebug)
      .catch(e => setDebugError(e.message))
      .finally(() => setDebugLoading(false));

    api.getWebhookStatus()
      .then(setWebhookStatus)
      .catch(() => setWebhookStatus(null));
  }, []);

  // Live auto-refresh effect
  useEffect(() => {
    if (liveMode) {
      const refresh = () => {
        api.getMaxDebugData()
          .then(d => { setMaxData(d); if (d.subscriptions) setWebhookStatus({ success: true, subscriptions: d.subscriptions }); })
          .catch(() => {});
      };
      refresh();
      liveIntervalRef.current = setInterval(refresh, 5000);
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }
    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [liveMode]);

  function loadMaxDebug() {
    setMaxLoading(true);
    setMaxError('');
    api.getMaxDebugData()
      .then(d => { setMaxData(d); if (d.subscriptions) setWebhookStatus({ success: true, subscriptions: d.subscriptions }); })
      .catch(e => setMaxError(e.message))
      .finally(() => setMaxLoading(false));
  }

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

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!sendTarget.trim() || !sendText.trim()) return;
    setSendLoading(true);
    setSendResult(null);
    try {
      await api.sendMaxMessage(sendTarget.trim(), sendText.trim());
      setSendResult({ success: true, message: `Сообщение отправлено пользователю ${sendTarget}` });
      setSendText('');
      // Refresh messages
      setTimeout(() => loadMaxDebug(), 500);
    } catch (err: unknown) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : 'Ошибка отправки',
      });
    } finally {
      setSendLoading(false);
    }
  }

  const envItems = debug
    ? Object.entries(debug.env_vars).map(([key, ok]) => ({ key, ok }))
    : [];

  // Filter messages for selected subscriber
  const subscriberMessages: MaxMessage[] = selectedSubscriber && maxData
    ? maxData.messages.filter(m => m.max_id === selectedSubscriber.max_id)
    : (maxData?.messages ?? []);

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
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${debug.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {debug.status === 'ok' ? '✓ Всё настроено' : '✗ Требуется настройка'}
              </span>
              <span className="text-sm text-gray-500">
                БД: {debug.db.status === 'ok' ? '✓ Подключена' : `✗ ${debug.db.status}`}
                {typeof debug.db.admin_count === 'number' && ` · Администраторов: ${debug.db.admin_count}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {envItems.map(({ key, ok }) => (
                <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
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

      {/* MAX Messenger Section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-gray-900 mb-1">🤖 MAX Messenger</h2>
          <p className="text-gray-500 text-xs">Настройка бота и отладка взаимодействия с подписчиками</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('webhook')}
            className={`px-5 py-3 text-sm font-medium transition-colors ${activeTab === 'webhook' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            📡 Webhook
          </button>
          <button
            onClick={() => { setActiveTab('debug'); if (!maxData && !maxLoading && !liveMode) loadMaxDebug(); }}
            className={`px-5 py-3 text-sm font-medium transition-colors ${activeTab === 'debug' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            🔬 Отладка
          </button>
        </div>

        <div className="p-5">
          {/* Webhook Tab */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              {webhookStatus?.success && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
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
                  <div className={`p-3 rounded-lg text-sm ${webhookResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-700'}`}>
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

              <div className="border-t pt-4">
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

              {/* Mini App integration info */}
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 font-medium mb-2">📱 Интеграция мини-приложения для курьеров:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 space-y-2">
                  <p>Используйте следующий URL при настройке Mini App в портале разработчика MAX:</p>
                  <code className="block bg-white border border-blue-300 rounded px-3 py-2 font-mono text-xs select-all">
                    {webhookUrl
                      ? webhookUrl.replace('/api/bot/webhook', '/courier')
                      : 'https://rezaryad.vercel.app/courier'}
                  </code>
                  <ol className="text-xs space-y-1 list-decimal list-inside text-blue-700">
                    <li>Откройте <a href="https://dev.max.ru" target="_blank" rel="noopener noreferrer" className="underline">dev.max.ru</a> → ваш бот → Mini App</li>
                    <li>Установите Mini App URL: <strong>https://{'<your-domain>'}/courier</strong></li>
                    <li>Сохраните настройки</li>
                    <li>Курьеры откроют приложение через бота и пройдут регистрацию</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Debug Tab */}
          {activeTab === 'debug' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600">Интерактивная отладка MAX-бота: подписчики, сообщения, отправка</p>
                <div className="flex items-center gap-2">
                  {liveMode && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-600 animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                      LIVE
                    </span>
                  )}
                  <button
                    onClick={() => setLiveMode(v => !v)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${liveMode ? 'bg-red-100 border border-red-300 text-red-700 hover:bg-red-200' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {liveMode ? '⏹ Стоп' : '▶ Live'}
                  </button>
                  <button
                    onClick={loadMaxDebug}
                    disabled={maxLoading || liveMode}
                    className="text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {maxLoading ? '...' : '🔄 Обновить'}
                  </button>
                </div>
              </div>

              {maxError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  Ошибка: {maxError}
                </div>
              )}

              {maxLoading && !maxData && (
                <div className="text-gray-400 text-sm text-center py-8">Загрузка данных MAX...</div>
              )}

              {maxData && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Subscribers list */}
                  <div className="lg:col-span-1">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      👥 Подписчики ({maxData.subscribers.length})
                    </h3>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      <button
                        onClick={() => setSelectedSubscriber(null)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${!selectedSubscriber ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                      >
                        Все сообщения ({maxData.messages.length})
                      </button>
                      {maxData.subscribers.map((sub: MaxSubscriberInfo) => {
                        const msgCount = maxData.messages.filter((m: MaxMessage) => m.max_id === sub.max_id).length;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => { setSelectedSubscriber(sub); setSendTarget(sub.max_id); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${selectedSubscriber?.id === sub.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                          >
                            <div className="font-medium">{sub.name || `MAX:${sub.max_id}`}</div>
                            <div className={`text-xs ${selectedSubscriber?.id === sub.id ? 'text-blue-200' : 'text-gray-400'}`}>
                              {sub.max_id} · {msgCount} сообщ.
                              {sub.registration_status === 'PENDING_REGISTRATION' && (
                                <span className="ml-1 bg-yellow-200 text-yellow-800 px-1 rounded">заявка</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {maxData.subscribers.length === 0 && (
                        <div className="text-gray-400 text-xs text-center py-4">Нет подписчиков</div>
                      )}
                    </div>
                  </div>

                  {/* Messages panel */}
                  <div className="lg:col-span-2 space-y-3">
                    {/* Subscriber info */}
                    {selectedSubscriber && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs">
                        <div className="flex flex-wrap gap-3">
                          <div><span className="text-gray-500">Имя:</span> <strong>{selectedSubscriber.name || '—'}</strong></div>
                          <div><span className="text-gray-500">MAX ID:</span> <code className="font-mono">{selectedSubscriber.max_id}</code></div>
                          <div><span className="text-gray-500">Язык:</span> {selectedSubscriber.language}</div>
                          <div><span className="text-gray-500">Статус:</span> {selectedSubscriber.registration_status === 'PENDING_REGISTRATION' ? '⏳ Заявка' : selectedSubscriber.is_verified ? '✓ Верифицирован' : 'Активен'}</div>
                          <div><span className="text-gray-500">Зарегистрирован:</span> {formatDate(selectedSubscriber.created_at)}</div>
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">
                        💬 Сообщения {selectedSubscriber ? `(${selectedSubscriber.name || selectedSubscriber.max_id})` : '(все)'}
                      </h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                        {subscriberMessages.length === 0 ? (
                          <div className="text-gray-400 text-xs text-center py-4">Нет сообщений</div>
                        ) : (
                          [...subscriberMessages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((msg: MaxMessage) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === 'OUT' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className={`max-w-xs px-3 py-2 rounded-xl text-xs ${msg.direction === 'OUT' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                                {!selectedSubscriber && msg.direction === 'IN' && (
                                  <div className={`text-xs mb-1 ${msg.direction === 'IN' ? 'text-gray-400' : 'text-blue-200'}`}>
                                    {msg.max_id}
                                  </div>
                                )}
                                <div>{msg.text}</div>
                                <div className={`text-xs mt-1 ${msg.direction === 'OUT' ? 'text-blue-200' : 'text-gray-400'}`}>
                                  {msg.direction === 'OUT' ? '→ отправлено' : '← получено'} · {formatDate(msg.created_at)}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Send message form */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">📤 Отправить тестовое сообщение</h3>
                      <form onSubmit={handleSendMessage} className="space-y-2">
                        <input
                          type="text"
                          value={sendTarget}
                          onChange={e => setSendTarget(e.target.value)}
                          placeholder="MAX ID получателя"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={sendText}
                            onChange={e => setSendText(e.target.value)}
                            placeholder="Текст сообщения..."
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={sendLoading || !sendTarget.trim() || !sendText.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                          >
                            {sendLoading ? '...' : '➤ Отправить'}
                          </button>
                        </div>
                        {sendResult && (
                          <div className={`p-2 rounded-lg text-xs ${sendResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {sendResult.message}
                          </div>
                        )}
                      </form>
                    </div>

                    {/* Subscriptions info */}
                    {!!maxData.subscriptions && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">🔔 Активные подписки MAX</h3>
                        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs overflow-auto whitespace-pre-wrap max-h-32">
                          {JSON.stringify(maxData.subscriptions, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-blue-500">
          <div className="text-2xl mb-2">📚</div>
          <h3 className="font-semibold text-gray-900 text-sm">Документация</h3>
          <p className="text-xs text-gray-500 mt-1">
            Инструкции по настройке в{' '}
            <a href="https://github.com/lemzakov/Rezaryad/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              README.md
            </a>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-green-500">
          <div className="text-2xl mb-2">🤖</div>
          <h3 className="font-semibold text-gray-900 text-sm">Max Developer Portal</h3>
          <p className="text-xs text-gray-500 mt-1">
            Получите токен бота на{' '}
            <a href="https://dev.max.ru" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              dev.max.ru
            </a>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-l-purple-500">
          <div className="text-2xl mb-2">📱</div>
          <h3 className="font-semibold text-gray-900 text-sm">Приложение курьеров</h3>
          <p className="text-xs text-gray-500 mt-1">
            URL мини-приложения:{' '}
            <code className="text-blue-600 text-xs">https://rezaryad.vercel.app/courier</code>
          </p>
        </div>
      </div>
    </div>
  );
}
