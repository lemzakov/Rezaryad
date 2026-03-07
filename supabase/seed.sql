-- ─────────────────────────────────────────────
-- Rezaryad seed data (development / staging only)
-- Run AFTER schema.sql in the Supabase SQL editor.
-- Admin passwords below are for LOCAL DEV only.
-- In production create admins with: npm run create-admin
-- ─────────────────────────────────────────────

-- ── Admin users ──────────────────────────────
-- Password for "admin"    : admin123
-- Password for "operator" : operator1
insert into admin_users (id, login, password_hash)
values
  ('a1000000-0000-0000-0000-000000000001', 'admin',
   '$2a$10$U2E4dmRiacCK4Husls0U5eqDxY4NyZVzDVZDPlBUs6ZySFbVCr4SK'),
  ('a1000000-0000-0000-0000-000000000002', 'operator',
   '$2a$10$vyRBNCXhr3/I8zs6nZ.fC.XeAe4ZqreScVGpweneRa5K.ZhVtbmnm')
on conflict (login) do nothing;

-- ── Sample lockers ────────────────────────────
insert into lockers (id, name, address, lat, lon, qr_code, is_active)
values
  ('l1000000-0000-0000-0000-000000000001', 'Локер #1 — Центр',
   'ул. Ленина, 1, Душанбе', 38.5598, 68.7740, 'QR-LOCKER-001', true),
  ('l1000000-0000-0000-0000-000000000002', 'Локер #2 — Вокзал',
   'пр. Рудаки, 42, Душанбе', 38.5510, 68.7714, 'QR-LOCKER-002', true),
  ('l1000000-0000-0000-0000-000000000003', 'Локер #3 — Рынок',
   'ул. Бохтар, 17, Душанбе', 38.5476, 68.7831, 'QR-LOCKER-003', false)
on conflict (id) do nothing;

-- ── Sample cells (3 cells per locker) ─────────
insert into cells (id, locker_id, number, status, has_charger)
values
  ('c1000000-0000-0000-0000-000000000001', 'l1000000-0000-0000-0000-000000000001', 1, 'FREE', true),
  ('c1000000-0000-0000-0000-000000000002', 'l1000000-0000-0000-0000-000000000001', 2, 'FREE', true),
  ('c1000000-0000-0000-0000-000000000003', 'l1000000-0000-0000-0000-000000000001', 3, 'BROKEN', false),
  ('c1000000-0000-0000-0000-000000000004', 'l1000000-0000-0000-0000-000000000002', 1, 'FREE', true),
  ('c1000000-0000-0000-0000-000000000005', 'l1000000-0000-0000-0000-000000000002', 2, 'BUSY', true),
  ('c1000000-0000-0000-0000-000000000006', 'l1000000-0000-0000-0000-000000000003', 1, 'FREE', false)
on conflict (id) do nothing;

-- ── Sample courier users ──────────────────────
insert into users (id, max_id, phone, language, is_verified, has_debt)
values
  ('u1000000-0000-0000-0000-000000000001', 'max-001', '+992901000001', 'RU', true, false),
  ('u1000000-0000-0000-0000-000000000002', 'max-002', '+992901000002', 'TJ', true, false),
  ('u1000000-0000-0000-0000-000000000003', 'max-003', '+992901000003', 'UZ', false, false)
on conflict (id) do nothing;

-- ── Sample tariff ─────────────────────────────
insert into tariffs (id, name, price_per_minute, is_subscription, free_mins, discount_pct, is_night)
values
  ('t1000000-0000-0000-0000-000000000001', 'Стандарт', 0.5000, false, 5, 0, false),
  ('t1000000-0000-0000-0000-000000000002', 'Ночной', 0.3000, false, 5, 0, true),
  ('t1000000-0000-0000-0000-000000000003', 'Подписка 30 дней', 0.2000, true, 10, 20, false)
on conflict (id) do nothing;
