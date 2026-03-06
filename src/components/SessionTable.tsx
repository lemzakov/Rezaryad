'use client';
import type { Session } from '@/lib/api';

interface SessionTableProps {
  sessions: Session[];
  showCourier?: boolean;
  showLocker?: boolean;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const statusLabel: Record<string, string> = {
  ACTIVE: 'Активна',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

const statusClass: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-600',
};

export default function SessionTable({ sessions, showCourier = true, showLocker = true }: SessionTableProps) {
  if (sessions.length === 0) {
    return <p className="text-center text-gray-400 py-8">Нет данных</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-left">
            <th className="px-4 py-3 font-medium rounded-tl-lg">ID</th>
            {showCourier && <th className="px-4 py-3 font-medium">Курьер</th>}
            {showLocker && <th className="px-4 py-3 font-medium">Локер</th>}
            <th className="px-4 py-3 font-medium">Ячейка</th>
            <th className="px-4 py-3 font-medium">Начало</th>
            <th className="px-4 py-3 font-medium">Конец</th>
            <th className="px-4 py-3 font-medium">Длительность</th>
            <th className="px-4 py-3 font-medium">Стоимость</th>
            <th className="px-4 py-3 font-medium rounded-tr-lg">Статус</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sessions.map(s => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-400">#{s.id}</td>
              {showCourier && <td className="px-4 py-3 font-medium">{s.courier_phone}</td>}
              {showLocker && <td className="px-4 py-3">{s.locker_name}</td>}
              <td className="px-4 py-3">#{s.cell_number}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(s.started_at)}</td>
              <td className="px-4 py-3 text-gray-600">{formatDate(s.ended_at)}</td>
              <td className="px-4 py-3">{formatDuration(s.duration_minutes)}</td>
              <td className="px-4 py-3 font-medium">
                {s.cost !== null ? `${s.cost} ₽` : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusClass[s.status] || 'bg-gray-100'}`}>
                  {statusLabel[s.status] || s.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
