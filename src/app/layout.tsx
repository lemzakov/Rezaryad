import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rezaryad Администратор',
  description: 'Панель управления системой аренды аккумуляторных локеров',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-100 text-gray-900 min-h-screen">{children}</body>
    </html>
  );
}
