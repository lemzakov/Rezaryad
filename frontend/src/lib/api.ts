import { getToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface DashboardStats {
  revenue_today: number;
  active_couriers: number;
  sessions_today: number;
  recent_anomalies: Anomaly[];
}

export interface Locker {
  id: number;
  name: string;
  address: string;
  lat: number;
  lon: number;
  qr_code: string;
  total_cells: number;
  free_cells: number;
  active_cells: number;
}

export interface Cell {
  id: number;
  locker_id: number;
  number: number;
  status: 'FREE' | 'BUSY' | 'BROKEN';
}

export interface Courier {
  id: number;
  max_id: string;
  phone: string;
  is_verified: boolean;
  has_debt: boolean;
  debt_amount: number;
  active_sessions: number;
  total_spent: number;
  session_count: number;
  last_activity: string | null;
}

export interface Session {
  id: number;
  courier_id: number;
  courier_phone: string;
  locker_id: number;
  locker_name: string;
  cell_id: number;
  cell_number: number;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface Anomaly {
  id: number;
  type: 'LONG_SESSION' | 'OPEN_DOOR' | 'DEBT';
  session_id?: number;
  courier_id?: number;
  courier_phone?: string;
  locker_id?: number;
  locker_name?: string;
  cell_id?: number;
  cell_number?: number;
  started_at?: string;
  duration_minutes?: number;
  debt_amount?: number;
  since?: string;
}

export interface LockerStats {
  revenue: number;
  session_count: number;
  avg_duration_minutes: number;
  occupancy_percent: number;
  daily_revenue: DailyRevenue[];
}

export interface CourierStats {
  total_spent: number;
  session_count: number;
  avg_duration_minutes: number;
  last_activity: string | null;
}

export interface OverallStats {
  daily_revenue: DailyRevenue[];
  total_revenue: number;
  total_sessions: number;
  avg_duration_minutes: number;
  active_couriers_count: number;
  locker_stats: LockerStatSummary[];
  courier_stats: CourierStatSummary[];
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  sessions: number;
}

export interface LockerStatSummary {
  locker_id: number;
  locker_name: string;
  revenue: number;
  session_count: number;
  occupancy_percent: number;
}

export interface CourierStatSummary {
  courier_id: number;
  courier_phone: string;
  total_spent: number;
  session_count: number;
}

export interface SessionsParams {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  lockerId?: string;
  courierId?: string;
  page?: number;
  limit?: number;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    apiFetch<LoginResponse>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getDashboardStats: () =>
    apiFetch<DashboardStats>('/api/admin/stats/dashboard'),

  getLockers: () =>
    apiFetch<Locker[]>('/api/admin/lockers'),

  getLocker: (id: number) =>
    apiFetch<Locker>(`/api/admin/lockers/${id}`),

  createLocker: (data: { name: string; address: string; lat: number; lon: number; qr_code: string }) =>
    apiFetch<Locker>('/api/admin/lockers', { method: 'POST', body: JSON.stringify(data) }),

  getCells: (lockerId: number) =>
    apiFetch<Cell[]>(`/api/admin/lockers/${lockerId}/cells`),

  getSessions: (params: SessionsParams = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);
    if (params.lockerId) query.set('locker_id', params.lockerId);
    if (params.courierId) query.set('courier_id', params.courierId);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<Session[]>(`/api/admin/sessions${qs ? '?' + qs : ''}`);
  },

  getCouriers: () =>
    apiFetch<Courier[]>('/api/admin/couriers'),

  getCourier: (id: number) =>
    apiFetch<Courier>(`/api/admin/couriers/${id}`),

  getCourierSessions: (id: number) =>
    apiFetch<Session[]>(`/api/admin/couriers/${id}/sessions`),

  getAnomalies: () =>
    apiFetch<{ long_sessions: Anomaly[]; open_doors: Anomaly[]; debtors: Anomaly[] }>('/api/admin/anomalies'),

  getStats: (period = '30d') =>
    apiFetch<OverallStats>(`/api/admin/stats?period=${period}`),

  getLockerStats: (id: number) =>
    apiFetch<LockerStats>(`/api/admin/lockers/${id}/stats`),

  getCourierStats: (id: number) =>
    apiFetch<CourierStats>(`/api/admin/couriers/${id}/stats`),
};
