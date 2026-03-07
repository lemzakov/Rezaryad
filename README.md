# Rezaryad Project

Rezaryad is a battery-locker rental system for couriers. Couriers interact with the system through a **MAX messenger bot** and a **mini-app** (accessible at `/courier`); operators manage everything through a web admin panel.

## Architecture

This is a **unified Next.js 15 application** deployed as a single Vercel project:

```
Rezaryad/
├── src/
│   ├── app/
│   │   ├── api/                   # REST API routes (Next.js Route Handlers)
│   │   │   ├── admin/             # Admin-only endpoints
│   │   │   │   ├── couriers/      # Courier management
│   │   │   │   ├── lockers/       # Locker management
│   │   │   │   ├── max/           # MAX messenger debug API
│   │   │   │   ├── sessions/      # Session management
│   │   │   │   ├── settings/      # Webhook configuration
│   │   │   │   ├── stats/         # Statistics
│   │   │   │   ├── anomalies/     # Anomaly detection
│   │   │   │   ├── cron/          # Scheduled jobs
│   │   │   │   ├── debug/         # System diagnostics
│   │   │   │   └── login/         # Admin authentication
│   │   │   ├── bot/webhook/       # MAX messenger webhook handler
│   │   │   ├── couriers/          # Courier self-service API
│   │   │   ├── bookings/          # Booking API
│   │   │   ├── sessions/          # Session API
│   │   │   ├── lockers/           # Locker API
│   │   │   └── tariffs/           # Tariff API
│   │   ├── courier/               # 📱 Courier mini-app (MAX WebApp)
│   │   ├── dashboard/             # Admin panel pages
│   │   │   ├── couriers/          # Courier management
│   │   │   ├── lockers/           # Locker management
│   │   │   ├── sessions/          # Session management
│   │   │   ├── settings/          # System settings + MAX debug
│   │   │   ├── stats/             # Statistics
│   │   │   └── anomalies/         # Anomaly monitoring
│   │   └── login/                 # Admin login page
│   └── lib/
│       ├── api.ts                 # Frontend API client
│       ├── auth.ts                # Client-side JWT helper
│       ├── config.ts              # Environment variable config
│       ├── db.ts                  # Supabase client
│       ├── jwt.ts                 # JWT signing/verification
│       ├── server-auth.ts         # Server-side auth helpers
│       ├── types.ts               # TypeScript types
│       └── services/              # Business logic
├── supabase/
│   ├── schema.sql                 # Database schema (run in Supabase SQL editor)
│   └── seed.sql                   # Seed data
└── scripts/
    ├── setup-db.mjs               # Auto-runs schema on deploy
    └── create-admin.mjs           # Auto-creates admin user on deploy
```

---

## Key URLs

| URL | Description |
|-----|-------------|
| `https://rezaryad.vercel.app/login` | Admin panel login |
| `https://rezaryad.vercel.app/dashboard` | Admin panel dashboard |
| **`https://rezaryad.vercel.app/courier`** | **📱 Courier mini-app (use this URL in MAX developer portal)** |
| `https://rezaryad.vercel.app/api/bot/webhook` | MAX messenger webhook endpoint |

---

## Quick-start

### 1. Clone and deploy to Vercel

```bash
git clone https://github.com/lemzakov/Rezaryad.git
```

Import the repo root as a new Vercel project (Framework Preset: **Next.js**).

### 2. Connect Supabase

In the Vercel dashboard, go to **Integrations** → connect your Supabase project. This automatically injects the required environment variables.

### 3. Set Environment Variables in Vercel

| Variable | Required | Description |
|---|---|---|
| `ADMIN_LOGIN` | ✅ | Admin panel username |
| `ADMIN_PASSWORD` | ✅ | Admin panel password (min 8 chars) |
| `MAX_BOT_TOKEN` | ✅ | Bot token from [Max developer portal](https://dev.max.ru) |
| `SECRET_KEY` | ⬜ | Random ≥32-char string for JWT signing. Falls back to `rezaryad_SUPABASE_JWT_SECRET`. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | From Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `CRON_SECRET` | ⬜ | Secret for Vercel Cron auth |

### 4. Initialize Database

After deployment, run the schema manually in the Supabase SQL editor:
- Open `supabase/schema.sql` and execute it in your Supabase project's SQL editor.
- Alternatively, the `scripts/setup-db.mjs` postbuild script auto-applies the schema on each Vercel deploy if `rezaryad_POSTGRES_URL_NON_POOLING` is available.

### 5. Register the MAX Bot Webhook

After deployment, go to **Admin Panel → Settings → MAX Messenger → Webhook** and register:

```
https://rezaryad.vercel.app/api/bot/webhook
```

Or use curl:
```bash
curl -X POST "https://platform-api.max.ru/subscriptions" \
  -H "Authorization: <MAX_BOT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://rezaryad.vercel.app/api/bot/webhook",
    "update_types": ["message_created", "message_callback", "bot_started"]
  }'
```

---

## Setting Up the Courier Mini-App in MAX

The courier registration app is at: **`https://rezaryad.vercel.app/courier`**

1. Log in to the [MAX developer portal](https://dev.max.ru).
2. Open your bot settings → **Mini App** section.
3. Set the **Mini App URL** to:
   ```
   https://rezaryad.vercel.app/courier
   ```
4. Save the settings.

### Courier Registration Flow

When a courier opens the mini-app inside MAX messenger:
1. The app automatically receives their **MAX ID** from the WebApp SDK.
2. The courier enters their **name**.
3. After submitting, a registration request is created with status **"Заявка на регистрацию"** (Pending Registration).
4. The admin sees the request in **Admin Panel → Couriers** with a yellow "⏳ Заявка" badge.
5. The admin clicks **"✓ Одобрить"** (Approve) to activate the courier.
6. The courier is marked as active and verified.

---

## MAX Messenger Debug Panel

In **Admin Panel → Settings → MAX Messenger → 🔬 Отладка**, you can:
- **View all subscribers** (couriers who have interacted with the bot)
- **Browse message history** — both incoming messages from couriers and outgoing notifications
- **Send test messages** to any subscriber by their MAX ID
- **View active webhook subscriptions**

---

## Cron Jobs

| Endpoint | Schedule | Tasks |
|---|---|---|
| `/api/admin/cron/run-all` | Daily at midnight UTC | Expire bookings · open-door reminders · anomaly alerts |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin login returns 401 | Wrong password | Set `ADMIN_LOGIN` and `ADMIN_PASSWORD` in Vercel env and redeploy |
| Bot does not respond | Webhook not registered or wrong token | Re-register webhook in Settings |
| Mini-app returns 401 | `MAX_BOT_TOKEN` mismatch | Ensure the same token is used in both the bot and mini-app |
| Courier registration not appearing | DB migration not applied | Re-run `supabase/schema.sql` in Supabase SQL editor |
