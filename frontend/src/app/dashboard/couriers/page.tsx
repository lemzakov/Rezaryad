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
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [courierSessions, setCourierSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    api.getCouriers()
      .then(data => { setCouriers(data); setFiltered(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(couriers.filter(c =>
      c.phone.toLowerCase().includes(q) || c.max_id?.toLowerCase().includes(q)
    ));
  }, [search, couriers]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Курьеры</h1>
        <p className="text-gray-500 text-sm mt-1">Список зарегистрированных курьеров</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Поиск по телефону или MAX ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && <div className="text-center text-gray-400 py-16">Загрузка...</div>}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-left">
                <th className="px-4 py-3 font-medium">MAX ID</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium">Верификация</th>
                <th className="px-4 py-3 font-medium">Долг</th>
                <th className="px-4 py-3 font-medium">Активных сессий</th>
                <th className="px-4 py-3 font-medium">Всего потрачено</th>
                <th className="px-4 py-3 font-medium">Последняя активность</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(courier => (
                <tr key={courier.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{courier.max_id || '—'}</td>
                  <td className="px-4 py-3 font-medium">{courier.phone}</td>
                  <td className="px-4 py-3">
                    {courier.is_verified
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-400">✗</span>}
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
                          {courier.active_sessions}
                        </span>
                      : '0'}
                  </td>
                  <td className="px-4 py-3 font-medium">{courier.total_spent} ₽</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(courier.last_activity)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => selectCourier(courier)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Сессии →
                    </button>
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
                <h2 className="text-lg font-bold text-gray-900">Сессии: {selectedCourier.phone}</h2>
                <p className="text-sm text-gray-500">MAX ID: {selectedCourier.max_id || '—'} | Сессий: {selectedCourier.session_count}</p>
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
