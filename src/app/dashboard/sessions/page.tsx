'use client';
import { useEffect, useState } from 'react';
import { api, Session, Locker } from '@/lib/api';
import SessionTable from '@/components/SessionTable';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lockerFilter, setLockerFilter] = useState('');
  const [courierFilter, setCourierFilter] = useState('');

  function loadSessions() {
    setLoading(true);
    api.getSessions({
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      lockerId: lockerFilter || undefined,
      courierId: courierFilter || undefined,
    })
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.getLockers().then(setLockers).catch(() => {});
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escapeCSV(value: string | number | undefined | null): string {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function exportCSV() {
    const headers = ['ID', 'Курьер', 'Локер', 'Ячейка', 'Начало', 'Конец', 'Длительность (мин)', 'Стоимость', 'Статус'];
    const rows = sessions.map(s => [
      s.id,
      s.courier_phone,
      s.locker_name,
      s.cell_number,
      s.started_at,
      s.ended_at || '',
      s.duration_minutes ?? '',
      s.cost ?? '',
      s.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сессии</h1>
          <p className="text-gray-500 text-sm mt-1">Все сессии аренды</p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          📥 Экспорт CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">Активные</option>
            <option value="COMPLETED">Завершённые</option>
            <option value="CANCELLED">Отменённые</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="С даты"
          />
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="По дату"
          />
          <select
            value={lockerFilter}
            onChange={e => setLockerFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все локеры</option>
            {lockers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input
            type="text"
            value={courierFilter}
            onChange={e => setCourierFilter(e.target.value)}
            placeholder="ID курьера"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={loadSessions}
          className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Применить фильтры
        </button>
      </div>

      {loading && <div className="text-center text-gray-400 py-16">Загрузка...</div>}
      {error && <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Результаты: {sessions.length} сессий</h2>
          </div>
          <SessionTable sessions={sessions} />
        </div>
      )}
    </div>
  );
}
