// TypeScript types matching the Supabase / PostgreSQL schema (snake_case columns)

export type Language = 'RU' | 'UZ' | 'TJ';
export type CellStatus = 'FREE' | 'BUSY' | 'BROKEN';
export type BookingStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'CONVERTED';
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type RegistrationStatus = 'PENDING_REGISTRATION' | 'ACTIVE';
export type MessageDirection = 'IN' | 'OUT';

export interface DbUser {
  id: string;
  max_id: string;
  phone: string | null;
  name: string | null;
  language: Language;
  is_verified: boolean;
  verification_data: Record<string, unknown> | null;
  has_debt: boolean;
  debt_amount: number;
  registration_status: RegistrationStatus;
  bot_state: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPaymentCard {
  id: string;
  user_id: string;
  card_token: string;
  last_four: string;
  is_active: boolean;
  created_at: string;
}

export interface DbLocker {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  qr_code: string;
  is_active: boolean;
  created_at: string;
}

export interface DbCell {
  id: string;
  locker_id: string;
  number: number;
  status: CellStatus;
  has_charger: boolean;
  created_at: string;
}

export interface DbTariff {
  id: string;
  name: string;
  price_per_minute: number;
  is_subscription: boolean;
  subscription_period: number | null;
  free_mins: number;
  discount_pct: number;
  is_night: boolean;
  created_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  tariff_id: string;
  start_at: string;
  end_at: string;
  is_active: boolean;
  auto_renew: boolean;
  created_at: string;
}

export interface DbBooking {
  id: string;
  user_id: string;
  cell_id: string;
  status: BookingStatus;
  is_free: boolean;
  ends_at: string;
  penalty_until: string | null;
  created_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  cell_id: string;
  booking_id: string | null;
  start_at: string;
  end_at: string | null;
  duration_mins: number | null;
  cost: number | null;
  is_paid: boolean;
  created_at: string;
}

export interface DbPayment {
  id: string;
  user_id: string;
  session_id: string | null;
  amount: number;
  status: PaymentStatus;
  card_token: string | null;
  created_at: string;
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  sent_at: string;
  is_read: boolean;
}

export interface DbAdminUser {
  id: string;
  login: string;
  password_hash: string;
  created_at: string;
}

export interface DbWaitQueue {
  id: string;
  user_id: string;
  locker_id: string;
  position: number;
  created_at: string;
}

export interface DbMaxMessage {
  id: string;
  user_id: string | null;
  max_id: string;
  direction: MessageDirection;
  text: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Database type — enables full type safety for all client operations.
// Row = shape returned by SELECT
// Insert = shape accepted by INSERT (id/timestamps optional, defaults provided by DB)
// Update = shape accepted by UPDATE (all optional)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserInsert {
  max_id: string;
  language?: Language;
  phone?: string | null;
  name?: string | null;
  is_verified?: boolean;
  verification_data?: Record<string, unknown> | null;
  has_debt?: boolean;
  debt_amount?: number;
  registration_status?: RegistrationStatus;
  bot_state?: string | null;
}

export interface PaymentCardInsert {
  user_id: string;
  card_token: string;
  last_four: string;
  is_active?: boolean;
}

export interface LockerInsert {
  name: string;
  address: string;
  lat: number;
  lon: number;
  qr_code: string;
  is_active?: boolean;
}

export interface CellInsert {
  locker_id: string;
  number: number;
  status?: CellStatus;
  has_charger?: boolean;
}

export interface TariffInsert {
  name: string;
  price_per_minute: number;
  is_subscription?: boolean;
  subscription_period?: number | null;
  free_mins?: number;
  discount_pct?: number;
  is_night?: boolean;
}

export interface SubscriptionInsert {
  user_id: string;
  tariff_id: string;
  start_at?: string;
  end_at: string;
  is_active?: boolean;
  auto_renew?: boolean;
}

export interface BookingInsert {
  user_id: string;
  cell_id: string;
  status?: BookingStatus;
  is_free?: boolean;
  ends_at: string;
  penalty_until?: string | null;
}

export interface SessionInsert {
  user_id: string;
  cell_id: string;
  booking_id?: string | null;
  start_at?: string;
  end_at?: string | null;
  duration_mins?: number | null;
  cost?: number | null;
  is_paid?: boolean;
}

export interface PaymentInsert {
  user_id: string;
  session_id?: string | null;
  amount: number;
  status?: PaymentStatus;
  card_token?: string | null;
}

export interface NotificationInsert {
  user_id: string;
  type: string;
  message: string;
  sent_at?: string;
  is_read?: boolean;
}

export interface AdminUserInsert {
  login: string;
  password_hash: string;
}

export interface WaitQueueInsert {
  user_id: string;
  locker_id: string;
  position: number;
}

export interface MaxMessageInsert {
  user_id?: string | null;
  max_id: string;
  direction?: MessageDirection;
  text: string;
}

export interface Database {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: UserInsert;
        Update: Partial<UserInsert & { id: string }>;
        Relationships: [];
      };
      payment_cards: {
        Row: DbPaymentCard;
        Insert: PaymentCardInsert;
        Update: Partial<PaymentCardInsert>;
        Relationships: [];
      };
      lockers: {
        Row: DbLocker;
        Insert: LockerInsert;
        Update: Partial<LockerInsert>;
        Relationships: [];
      };
      cells: {
        Row: DbCell;
        Insert: CellInsert;
        Update: Partial<CellInsert>;
        Relationships: [];
      };
      tariffs: {
        Row: DbTariff;
        Insert: TariffInsert;
        Update: Partial<TariffInsert>;
        Relationships: [];
      };
      subscriptions: {
        Row: DbSubscription;
        Insert: SubscriptionInsert;
        Update: Partial<SubscriptionInsert>;
        Relationships: [];
      };
      bookings: {
        Row: DbBooking;
        Insert: BookingInsert;
        Update: Partial<BookingInsert>;
        Relationships: [];
      };
      sessions: {
        Row: DbSession;
        Insert: SessionInsert;
        Update: Partial<SessionInsert>;
        Relationships: [];
      };
      payments: {
        Row: DbPayment;
        Insert: PaymentInsert;
        Update: Partial<PaymentInsert>;
        Relationships: [];
      };
      notifications: {
        Row: DbNotification;
        Insert: NotificationInsert;
        Update: Partial<NotificationInsert>;
        Relationships: [];
      };
      admin_users: {
        Row: DbAdminUser;
        Insert: AdminUserInsert;
        Update: Partial<AdminUserInsert>;
        Relationships: [];
      };
      wait_queue: {
        Row: DbWaitQueue;
        Insert: WaitQueueInsert;
        Update: Partial<WaitQueueInsert>;
        Relationships: [];
      };
      max_messages: {
        Row: DbMaxMessage;
        Insert: MaxMessageInsert;
        Update: Partial<MaxMessageInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: {
      language_enum: Language;
      cell_status: CellStatus;
      booking_status: BookingStatus;
      payment_status: PaymentStatus;
    };
  };
}


