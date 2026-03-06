'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, DashboardStats, Anomaly } from '@/lib/api';
import StatsCard from '@/components/StatsCard';

function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboardStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-lg">Загрузка...</div>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
      Ошибка: {error}
    </div>
  );

  const quickLinks = [
    { href: '/dashboard/lockers', label: 'Локеры', icon: '🔋', desc: 'Управление локерами' },
    { href: '/dashboard/couriers', label: 'Курьеры', icon: '🚴', desc: 'Список курьеров' },
    { href: '/dashboard/sessions', label: 'Сессии', icon: '📋', desc: 'Все сессии' },
    { href: '/dashboard/anomalies', label: 'Аномалии', icon: '⚠️', desc: 'Нестандартные ситуации' },
    { href: '/dashboard/stats', label: 'Статистика', icon: '📊', desc: 'Аналитика и отчёты' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Панель управления</h1>
        <p className="text-gray-500 text-sm mt-1">Обзор системы Rezaryad</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Выручка сегодня"
          value={stats ? `${stats.revenue_today} ₽` : '—'}
          accent="green"
          icon="💰"
        />
        <StatsCard
          title="Активные курьеры"
          value={stats?.active_couriers ?? '—'}
          subtitle="≥1 сессии за неделю"
          accent="blue"
          icon="🚴"
        />
        <StatsCard
          title="Сессий сегодня"
          value={stats?.sessions_today ?? '—'}
          accent="purple"
          icon="📋"
        />
      </div>

      {stats?.recent_anomalies && stats.recent_anomalies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">⚠️ Последние аномалии</h2>
            <Link href="/dashboard/anomalies" className="text-sm text-blue-600 hover:underline">
              Все аномалии →
            </Link>
          </div>
          <div className="space-y-2">
            {stats.recent_anomalies.slice(0, 5).map((a: Anomaly) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <span className="text-yellow-500">⚠️</span>
                <div className="flex-1 text-sm">
                  {a.type === 'LONG_SESSION' && (
                    <span>Длинная сессия: <b>{a.courier_phone}</b> в {a.locker_name} — {formatDuration(a.duration_minutes)}</span>
                  )}
                  {a.type === 'OPEN_DOOR' && (
                    <span>Открытая дверь: {a.locker_name}, ячейка #{a.cell_number}</span>
                  )}
                  {a.type === 'DEBT' && (
                    <span>Долг: <b>{a.courier_phone}</b> — {a.debt_amount} ₽</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Быстрый доступ</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickLinks.map(link => (
            <Link key={link.href} href={link.href}>
              <div className="p-4 rounded-xl bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 transition-all text-center cursor-pointer">
                <div className="text-2xl mb-2">{link.icon}</div>
                <div className="text-sm font-medium text-gray-900">{link.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{link.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
