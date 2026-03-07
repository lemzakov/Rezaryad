'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Панель управления', icon: '🏠' },
  { href: '/dashboard/lockers', label: 'Локеры', icon: '🔋' },
  { href: '/dashboard/couriers', label: 'Курьеры', icon: '🚴' },
  { href: '/dashboard/sessions', label: 'Сессии', icon: '📋' },
  { href: '/dashboard/anomalies', label: 'Аномалии', icon: '⚠️' },
  { href: '/dashboard/stats', label: 'Статистика', icon: '📊' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔋</span>
          <div>
            <div className="text-white font-bold text-lg leading-tight">Rezaryad</div>
            <div className="text-slate-400 text-xs">Администратор</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(item => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
