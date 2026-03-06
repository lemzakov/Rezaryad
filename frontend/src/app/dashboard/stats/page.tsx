'use client';
import { useEffect, useState } from 'react';
import { api, OverallStats } from '@/lib/api';
import StatsCard from '@/components/StatsCard';

function BarChart({ data, maxValue }: { data: { label: string; value: number }[]; maxValue: number }) {
  if (data.length === 0) return <p className="text-center text-gray-400 py-4">Нет данных</p>;
  const max = maxValue !== 0 ? maxValue : Math.max(...data.map(d => d.value), 1);
  const width = 700;
  const height = 200;
  const barWidth = Math.floor((width - 40) / data.length) - 2;
  const padLeft = 40;
  const padBottom = 30;
  const chartH = height - padBottom;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: 200 }}>
      {[0, 0.25, 0.5, 0.75, 1].map(p => {
        const y = chartH - p * chartH;
        return (
          <g key={p}>
            <line x1={padLeft} x2={width} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padLeft - 4} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              {Math.round(p * max)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = max > 0 ? (d.value / max) * chartH : 0;
        const x = padLeft + i * (barWidth + 2);
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barH} fill="#3b82f6" rx={2} opacity={0.85} />
            {data.length <= 15 && (
              <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" fontSize={9} fill="#6b7280">
                {d.label.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<OverallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overall' | 'lockers' | 'couriers'>('overall');

  useEffect(() => {
    api.getStats('30d')
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-gray-400 py-16">Загрузка...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>;
  if (!stats) return null;

  const tabs = [
    { id: 'overall', label: 'Общая статистика' },
    { id: 'lockers', label: 'По локерам' },
    { id: 'couriers', label: 'По курьерам' },
  ];

  const chartData = stats.daily_revenue.map(d => ({ label: d.date, value: d.revenue }));
  const maxRevenue = Math.max(...stats.daily_revenue.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Статистика</h1>
        <p className="text-gray-500 text-sm mt-1">Аналитика и отчёты за последние 30 дней</p>
      </div>

      <div className="flex gap-2 bg-white rounded-xl shadow-sm p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overall' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard title="Общая выручка" value={`${stats.total_revenue} ₽`} accent="green" icon="💰" />
            <StatsCard title="Всего сессий" value={stats.total_sessions} accent="blue" icon="📋" />
            <StatsCard title="Ср. длительность" value={`${Math.round(stats.avg_duration_minutes)} мин`} accent="purple" icon="⏱️" />
            <StatsCard title="Активных курьеров" value={stats.active_couriers_count} accent="yellow" icon="🚴" />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Выручка за последние 30 дней</h2>
            <BarChart data={chartData} maxValue={maxRevenue} />
          </div>
        </div>
      )}

      {activeTab === 'lockers' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Статистика по локерам</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-3 font-medium">Локер</th>
                  <th className="px-4 py-3 font-medium">Выручка</th>
                  <th className="px-4 py-3 font-medium">Сессий</th>
                  <th className="px-4 py-3 font-medium">Занятость</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.locker_stats.map(ls => {
                  const occ = ls.occupancy_percent;
                  const occColor =
                    occ < 50 ? 'bg-green-100 text-green-700' :
                    occ < 80 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700';
                  return (
                    <tr key={ls.locker_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{ls.locker_name}</td>
                      <td className="px-4 py-3">{ls.revenue} ₽</td>
                      <td className="px-4 py-3">{ls.session_count}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${occColor}`}>
                          {occ}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {stats.locker_stats.length === 0 && (
              <p className="text-center text-gray-400 py-8">Нет данных</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'couriers' && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Статистика по курьерам</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-4 py-3 font-medium">Курьер</th>
                  <th className="px-4 py-3 font-medium">Всего потрачено</th>
                  <th className="px-4 py-3 font-medium">Сессий</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.courier_stats.map(cs => (
                  <tr key={cs.courier_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{cs.courier_phone}</td>
                    <td className="px-4 py-3 font-semibold text-blue-600">{cs.total_spent} ₽</td>
                    <td className="px-4 py-3">{cs.session_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.courier_stats.length === 0 && (
              <p className="text-center text-gray-400 py-8">Нет данных</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
