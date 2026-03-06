'use client';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  icon?: string;
}

const accentClasses: Record<string, string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red: 'border-l-red-500',
  purple: 'border-l-purple-500',
};

const iconBg: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  red: 'bg-red-100 text-red-600',
  purple: 'bg-purple-100 text-purple-600',
};

export default function StatsCard({ title, value, subtitle, accent = 'blue', icon }: StatsCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${accentClasses[accent]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${iconBg[accent]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
