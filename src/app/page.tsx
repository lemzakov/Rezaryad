'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const hasTelegram = typeof window !== 'undefined' && typeof window.Telegram !== 'undefined';
    const hasWebApp = hasTelegram && typeof window.Telegram?.WebApp !== 'undefined';
    const hasInitData = hasWebApp && !!(window.Telegram?.WebApp?.initData);
    console.log('[/] Main page load', {
      url: window.location.href,
      hasTelegram,
      hasWebApp,
      hasInitData,
      isAuthenticated: isAuthenticated(),
    });
    if (isAuthenticated()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return null;
}
