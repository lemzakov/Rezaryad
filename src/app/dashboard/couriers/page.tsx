'use client';
import { useEffect, useState } from 'react';
import { api, Courier, Session } from '@/lib/api';
import SessionTable from '@/components/SessionTable';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [filtered, setFiltered] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active'>('all');
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [courierSessions, setCourierSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | number | null>(null);

  function loadCouriers() {
    setLoading(true);
    api.getCouriers()
      .then(data => { setCouriers(data); setFiltered(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCouriers(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    let list = couriers;
    if (filter === 'pending') list = list.filter(c => c.registration_status === 'PENDING_REGISTRATION');
    else if (filter === 'active') list = list.filter(c => c.registration_status !== 'PENDING_REGISTRATION');
    setFiltered(list.filter(c =>
      (c.phone || '').toLowerCase().includes(q) ||
      (c.max_id || '').toLowerCase().includes(q) ||
      (c.name || '').toLowerCase().includes(q)
    ));
  }, [search, couriers, filter]);

  async function selectCourier(courier: Courier) {
    setSelectedCourier(courier);
    setSessionsLoading(true);
    try {
      const sessions = await api.getCourierSessions(courier.id);
      setCourierSessions(sessions);
    } catch {
      setCourierSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function handleApprove(courier: Courier, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Подтвердить регистрацию курьера ${courier.name || courier.max_id}?`)) return;
    setApprovingId(courier.id);
    try {
      await api.approveCourier(courier.id);
      loadCouriers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Ошибка подтверждения');
    } finally {
      setApprovingId(null);
    }
  }

  const pendingCount = couriers.filter(c => c.registration_status === 'PENDING_REGISTRATION').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Курьеры</h1>
        <p className="text-gray-500 text-sm mt-1">Список зарегистрированных курьеров</p>
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="font-semibold text-yellow-900">
              {pendingCount} {pendingCount === 1 ? 'заявка на регистрацию' : 'заявки на регистрацию'}
            </p>
            <p className="text-sm text-yellow-700">Требуется подтверждение.</p>
          </div>
          <button
            onClick={() => setFilter('pending')}
            className="ml-auto text-xs font-medium text-yellow-800 border border-yellow-400 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors"
          >
            Показать заявки
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Поиск по имени, телефону или MAX ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-2">
          {(['all', 'pending', 'active'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'pending' ? `⏳ Заявки${pendingCount > 0 ? ` (${pendingCount})` : ''}` : '✓ Активные'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-center text-gray-400 py-16">Загрузка...</div>}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3 font-medium">Имя / Телефон</th>
                <th className="px-4 py-3 font-medium">MAX ID</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 font-medium">Долг</th>
                <th className="px-4 py-3 font-medium">Сессий</th>
                <th className="px-4 py-3 font-medium">Последняя активность</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(courier => (
                <tr key={courier.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{courier.name || '—'}</div>
                    <div className="text-xs text-gray-500">{courier.phone}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600 text-xs">{courier.max_id || '—'}</td>
                  <td className="px-4 py-3">
                    {courier.registration_status === 'PENDING_REGISTRATION' ? (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                        ⏳ Заявка на регистрацию
                      </span>
                    ) : courier.is_verified ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full">
                        ✓ Активен
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                        Не верифицирован
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {courier.has_debt
                      ? <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {courier.debt_amount} ₽
                        </span>
                      : <span className="text-gray-400 text-xs">Нет</span>}
                  </td>
                  <td className="px-4 py-3">
                    {courier.active_sessions > 0
                      ? <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {courier.active_sessions} активных
                        </span>
                      : <span className="text-gray-500">{courier.session_count}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(courier.last_activity)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center">
                      {courier.registration_status === 'PENDING_REGISTRATION' && (
                        <button
                          onClick={e => handleApprove(courier, e)}
                          disabled={approvingId === courier.id}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {approvingId === courier.id ? '...' : '✓ Одобрить'}
                        </button>
                      )}
                      <button
                        onClick={() => selectCourier(courier)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Сессии →
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-8">Курьеры не найдены</div>
          )}
        </div>
      )}

      {selectedCourier && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Сессии: {selectedCourier.name || selectedCourier.phone}
                </h2>
                <p className="text-sm text-gray-500">
                  MAX ID: {selectedCourier.max_id || '—'} | Сессий: {selectedCourier.session_count}
                </p>
              </div>
              <button
                onClick={() => setSelectedCourier(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5">
              {sessionsLoading
                ? <div className="text-center text-gray-400 py-8">Загрузка сессий...</div>
                : <SessionTable sessions={courierSessions} showCourier={false} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
