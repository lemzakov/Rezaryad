-- Rezaryad database schema for Supabase (PostgreSQL)
-- Run this in the Supabase SQL editor to create all tables.

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Enum types
-- ─────────────────────────────────────────────
do $$ begin
  create type language_enum as enum ('RU', 'UZ', 'TJ');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cell_status as enum ('FREE', 'BUSY', 'BROKEN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type booking_status as enum ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CONVERTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('PENDING', 'SUCCESS', 'FAILED');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

create table if not exists users (
  id              text        primary key default gen_random_uuid()::text,
  max_id          text        unique not null,
  phone           text,
  language        language_enum not null default 'RU',
  is_verified     boolean     not null default false,
  verification_data jsonb,
  has_debt        boolean     not null default false,
  debt_amount     numeric(10,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists payment_cards (
  id          text    primary key default gen_random_uuid()::text,
  user_id     text    not null references users(id),
  card_token  text    not null,
  last_four   text    not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists lockers (
  id          text    primary key default gen_random_uuid()::text,
  name        text    not null,
  address     text    not null,
  lat         double precision not null,
  lon         double precision not null,
  qr_code     text    unique not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists cells (
  id          text        primary key default gen_random_uuid()::text,
  locker_id   text        not null references lockers(id),
  number      integer     not null,
  status      cell_status not null default 'FREE',
  has_charger boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists tariffs (
  id                  text    primary key default gen_random_uuid()::text,
  name                text    not null,
  price_per_minute    numeric(8,4) not null,
  is_subscription     boolean not null default false,
  subscription_period integer,
  free_mins           integer not null default 5,
  discount_pct        numeric(5,2) not null default 0,
  is_night            boolean not null default false,
  created_at          timestamptz not null default now()
);

create table if not exists subscriptions (
  id          text    primary key default gen_random_uuid()::text,
  user_id     text    not null references users(id),
  tariff_id   text    not null references tariffs(id),
  start_at    timestamptz not null default now(),
  end_at      timestamptz not null,
  is_active   boolean not null default true,
  auto_renew  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists bookings (
  id            text          primary key default gen_random_uuid()::text,
  user_id       text          not null references users(id),
  cell_id       text          not null references cells(id),
  status        booking_status not null default 'ACTIVE',
  is_free       boolean       not null default true,
  ends_at       timestamptz   not null,
  penalty_until timestamptz,
  created_at    timestamptz   not null default now()
);

create table if not exists sessions (
  id            text    primary key default gen_random_uuid()::text,
  user_id       text    not null references users(id),
  cell_id       text    not null references cells(id),
  booking_id    text    references bookings(id),
  start_at      timestamptz not null default now(),
  end_at        timestamptz,
  duration_mins numeric(10,2),
  cost          numeric(10,2),
  is_paid       boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists payments (
  id          text          primary key default gen_random_uuid()::text,
  user_id     text          not null references users(id),
  session_id  text          references sessions(id),
  amount      numeric(10,2) not null,
  status      payment_status not null default 'PENDING',
  card_token  text,
  created_at  timestamptz not null default now()
);

create table if not exists notifications (
  id        text    primary key default gen_random_uuid()::text,
  user_id   text    not null references users(id),
  type      text    not null,
  message   text    not null,
  sent_at   timestamptz not null default now(),
  is_read   boolean not null default false
);

create table if not exists admin_users (
  id            text primary key default gen_random_uuid()::text,
  login         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists wait_queue (
  id          text    primary key default gen_random_uuid()::text,
  user_id     text    not null references users(id),
  locker_id   text    not null references lockers(id),
  position    integer not null,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- Indexes for common query patterns
-- ─────────────────────────────────────────────
create index if not exists idx_users_max_id on users(max_id);
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_cell_id on sessions(cell_id);
create index if not exists idx_sessions_end_at on sessions(end_at) where end_at is null;
create index if not exists idx_bookings_user_id on bookings(user_id);
create index if not exists idx_bookings_status on bookings(status);
create index if not exists idx_cells_locker_id on cells(locker_id);
create index if not exists idx_cells_status on cells(status);
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_wait_queue_locker_id on wait_queue(locker_id);
create index if not exists idx_payment_cards_user_id on payment_cards(user_id);

-- ─────────────────────────────────────────────
-- Row Level Security (RLS)
-- All access via service role key from the Next.js backend,
-- so RLS is disabled. Enable and add policies when adding
-- direct client-side Supabase access.
-- ─────────────────────────────────────────────
alter table users disable row level security;
alter table payment_cards disable row level security;
alter table lockers disable row level security;
alter table cells disable row level security;
alter table tariffs disable row level security;
alter table subscriptions disable row level security;
alter table bookings disable row level security;
alter table sessions disable row level security;
alter table payments disable row level security;
alter table notifications disable row level security;
alter table admin_users disable row level security;
alter table wait_queue disable row level security;

-- ─────────────────────────────────────────────
-- Auto-update updated_at on users
-- ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_updated_at on users;
create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at();
