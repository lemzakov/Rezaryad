'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, Locker, Cell, Session, LockerStats } from '@/lib/api';
import SessionTable from '@/components/SessionTable';
import StatsCard from '@/components/StatsCard';

const cellStatusLabel: Record<string, string> = { FREE: 'Свободна', BUSY: 'Занята', BROKEN: 'Сломана' };
const cellStatusClass: Record<string, string> = {
  FREE: 'bg-green-100 text-green-700 border-green-200',
  BUSY: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  BROKEN: 'bg-red-100 text-red-600 border-red-200',
};

export default function LockerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const lockerId = parseInt(id);

  const [locker, setLocker] = useState<Locker | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<LockerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getLocker(lockerId),
      api.getCells(lockerId),
      api.getSessions({ lockerId: String(lockerId), status: 'ACTIVE' }),
      api.getLockerStats(lockerId),
    ])
      .then(([l, c, s, st]) => {
        setLocker(l);
        setCells(c);
        setSessions(s);
        setStats(st);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lockerId]);

  if (loading) return <div className="text-center text-gray-400 py-16">Загрузка...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-xl">Ошибка: {error}</div>;
  if (!locker) return null;

  const occupancy = locker.total_cells > 0
    ? Math.round(((locker.total_cells - locker.free_cells) / locker.total_cells) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/lockers" className="text-gray-400 hover:text-gray-600 text-sm">← Локеры</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">{locker.name}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🔋</div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{locker.name}</h2>
            <p className="text-gray-500 text-sm">{locker.address}</p>
            <p className="text-gray-400 text-xs mt-1">
              GPS: {locker.lat}, {locker.lon} | QR: {locker.qr_code}
            </p>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard title="Выручка" value={`${stats.revenue} ₽`} accent="green" icon="💰" />
          <StatsCard title="Сессий" value={stats.session_count} accent="blue" icon="📋" />
          <StatsCard title="Ср. длительность" value={`${Math.round(stats.avg_duration_minutes)} мин`} accent="purple" icon="⏱️" />
          <StatsCard title="Занятость" value={`${occupancy}%`} accent={occupancy > 80 ? 'red' : occupancy > 50 ? 'yellow' : 'green'} icon="📊" />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Ячейки ({cells.length})</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {cells.map(cell => (
            <div
              key={cell.id}
              className={`border rounded-lg p-2 text-center text-xs font-medium ${cellStatusClass[cell.status] || 'bg-gray-100'}`}
            >
              <div className="text-base font-bold">#{cell.number}</div>
              <div>{cellStatusLabel[cell.status] || cell.status}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Активные сессии ({sessions.length})</h2>
        <SessionTable sessions={sessions} showLocker={false} />
      </div>
    </div>
  );
}
