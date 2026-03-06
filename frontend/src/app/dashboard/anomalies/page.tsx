'use client';
import { useEffect, useState } from 'react';
import { api, Anomaly } from '@/lib/api';

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AnomaliesPage() {
  const [data, setData] = useState<{ long_sessions: Anomaly[]; open_doors: Anomaly[]; debtors: Anomaly[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAnomalies()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-gray-400 py-16">Загрузка...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Аномалии</h1>
        <p className="text-gray-500 text-sm mt-1">Нестандартные ситуации, требующие внимания</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">⏳ Долгие сессии</h2>
        <p className="text-xs text-gray-400 mb-4">Сессии продолжительностью более 2 часов</p>
        {data.long_sessions.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">Долгих сессий нет ✓</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left">
                    <th className="px-4 py-3 font-medium">ID сессии</th>
                    <th className="px-4 py-3 font-medium">Курьер</th>
                    <th className="px-4 py-3 font-medium">Локер</th>
                    <th className="px-4 py-3 font-medium">Ячейка</th>
                    <th className="px-4 py-3 font-medium">Начало</th>
                    <th className="px-4 py-3 font-medium">Длительность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.long_sessions.map(a => (
                    <tr key={a.id} className="hover:bg-yellow-50">
                      <td className="px-4 py-3 text-gray-400">#{a.session_id}</td>
                      <td className="px-4 py-3 font-medium">{a.courier_phone}</td>
                      <td className="px-4 py-3">{a.locker_name}</td>
                      <td className="px-4 py-3">#{a.cell_number}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(a.started_at)}</td>
                      <td className="px-4 py-3">
                        <span className="text-orange-600 font-semibold">{formatDuration(a.duration_minutes)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">🚪 Открытые двери без сессии</h2>
        <p className="text-xs text-gray-400 mb-4">Ячейки с открытыми дверями без активной сессии</p>
        {data.open_doors.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">Открытых дверей нет ✓</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left">
                    <th className="px-4 py-3 font-medium">Локер</th>
                    <th className="px-4 py-3 font-medium">Ячейка</th>
                    <th className="px-4 py-3 font-medium">Открыта с</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.open_doors.map(a => (
                    <tr key={a.id} className="hover:bg-red-50">
                      <td className="px-4 py-3 font-medium">{a.locker_name}</td>
                      <td className="px-4 py-3">#{a.cell_number}</td>
                      <td className="px-4 py-3 text-red-600">{formatDate(a.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-1">💸 Курьеры с долгом</h2>
        <p className="text-xs text-gray-400 mb-4">Курьеры с неоплаченной задолженностью</p>
        {data.debtors.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">Должников нет ✓</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-left">
                    <th className="px-4 py-3 font-medium">Курьер</th>
                    <th className="px-4 py-3 font-medium">Сумма долга</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.debtors.map(a => (
                    <tr key={a.id} className="hover:bg-red-50">
                      <td className="px-4 py-3 font-medium">{a.courier_phone}</td>
                      <td className="px-4 py-3">
                        <span className="text-red-600 font-bold">{a.debt_amount} ₽</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
