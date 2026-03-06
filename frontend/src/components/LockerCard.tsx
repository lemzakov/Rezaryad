'use client';
import Link from 'next/link';
import type { Locker } from '@/lib/api';

interface LockerCardProps {
  locker: Locker;
}

export default function LockerCard({ locker }: LockerCardProps) {
  const occupancy = locker.total_cells > 0
    ? Math.round(((locker.total_cells - locker.free_cells) / locker.total_cells) * 100)
    : 0;

  const occupancyColor =
    occupancy < 50 ? 'text-green-600 bg-green-100' :
    occupancy < 80 ? 'text-yellow-600 bg-yellow-100' :
    'text-red-600 bg-red-100';

  const barColor =
    occupancy < 50 ? 'bg-green-500' :
    occupancy < 80 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <Link href={`/dashboard/lockers/${locker.id}`}>
      <div className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer border border-gray-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{locker.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{locker.address}</p>
          </div>
          <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${occupancyColor}`}>
            {occupancy}%
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Занятость</span>
            <span>{locker.total_cells - locker.free_cells} / {locker.total_cells} ячеек</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${occupancy}%` }} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-green-600 font-medium">🟢 {locker.free_cells} свободно</span>
            <span className="text-blue-600 font-medium">{locker.active_cells} активных</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
