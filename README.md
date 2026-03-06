# Rezaryad Project

Rezaryad is a battery-locker rental system for couriers, built with FastAPI (backend) and Next.js (frontend). Couriers interact with the system through a Max messenger bot and mini-app; operators manage everything through a web admin panel.

## Project Structure

```
Rezaryad/
├── backend/          # FastAPI server, Prisma ORM, bot handlers
│   ├── app/
│   │   ├── api/      # REST API routes (admin, couriers, lockers, …)
│   │   ├── bot/      # Max messenger bot webhook handlers
│   │   ├── middleware/ # JWT auth helpers
│   │   ├── services/ # Business logic (booking, session, payment, …)
│   │   ├── config.py # All env-var driven settings
│   │   ├── db.py     # Prisma async client
│   │   └── main.py   # FastAPI app + scheduler
│   ├── prisma/
│   │   └── schema.prisma
│   ├── requirements.txt
│   └── .env.example
└── frontend/         # Next.js 14 admin panel (Vercel-ready)
    ├── src/
    │   ├── app/      # App router pages (login, dashboard, …)
    │   └── lib/      # API client, auth helpers
    └── .env.example
```

---

## Quick-start

### 1. Clone and configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Frontend
cp frontend/.env.example frontend/.env.local
```

Edit `backend/.env` with your real values (see section below).
Edit `frontend/.env.local` — set `NEXT_PUBLIC_API_URL` to your backend URL.

---

### 2. Backend environment variables (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/rezaryad` |
| `MAX_BOT_TOKEN` | ✅ | Token obtained from [Max developer portal](https://dev.max.ru) when you register your bot |
| `SECRET_KEY` | ✅ | Random string ≥32 chars used to sign JWTs. **Never share this.** |
| `ADMIN_PASSWORD` | ✅ | Password for the built-in `admin` account. Set this and the server auto-creates/updates the user on every startup. |
| `ACQUIRING_API_KEY` | ⬜ | Payment gateway API key |
| `ACQUIRING_BASE_URL` | ⬜ | Payment gateway base URL |
| `GOSUSLUGI_CLIENT_ID` | ⬜ | Gosuslugi OAuth client ID (identity verification) |
| `GOSUSLUGI_CLIENT_SECRET` | ⬜ | Gosuslugi OAuth client secret |
| `CORS_ORIGINS` | ⬜ | Comma-separated list of allowed frontend origins, e.g. `https://rezaryad.vercel.app`. Leave empty to allow all origins (dev only). |

Generate a secure `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

### 3. Install dependencies & run database migrations

```bash
cd backend
pip install -r requirements.txt

# Generate the Prisma client
prisma generate

# Apply database migrations (creates all tables)
prisma db push
```

---

### 4. Set the admin password

The admin panel login is `admin`. Set its password via the `ADMIN_PASSWORD` environment variable in `backend/.env`:

```dotenv
ADMIN_PASSWORD=MySecretPassword123
```

The backend automatically creates (or updates) the `admin` account every time it starts. Just restart the server after changing this value to apply a new password.

---

### 5. Start the backend server

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

---

### 6. Start the frontend (admin panel)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000/login` and sign in with login `admin` and the password from `ADMIN_PASSWORD`.

---

### 7. Register the Max messenger bot webhook

After the backend is publicly reachable (e.g., deployed on a VPS or exposed via `ngrok`), register the webhook with Max:

```bash
curl -X POST "https://botapi.max.ru/subscriptions" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-public-backend-host>/bot/webhook",
    "update_types": ["message_created", "message_callback"]
  }' \
  "?access_token=<MAX_BOT_TOKEN>"
```

Replace `<your-public-backend-host>` and `<MAX_BOT_TOKEN>` with your values.

---

### 8. Set up the Mini App in Max (for courier authentication)

1. Log in to the [Max developer portal](https://dev.max.ru).
2. Open your bot settings → **Mini App** section.
3. Set the **Mini App URL** to your deployed **frontend** URL, e.g.:
   ```
   https://rezaryad.vercel.app
   ```
4. Save the settings.

When a courier opens the mini-app inside Max, the app receives an `initData` string from the Max SDK. Send it to the backend to obtain a JWT:

```http
POST /api/couriers/miniapp-auth
Content-Type: application/json

{ "initData": "<raw initData string from Max SDK>" }
```

Response:
```json
{ "access_token": "eyJ...", "token_type": "bearer" }
```

Use the returned `access_token` as a Bearer token for all subsequent courier API calls (`Authorization: Bearer <token>`).

---

## Deployment

### Single Vercel Project (recommended)

The whole stack — Next.js admin panel **and** FastAPI backend — deploys as
**one Vercel project** from the repository root.

1. **Import the repo root** (not the `frontend/` subfolder) as a new Vercel project.
2. Set the following **Environment Variables** in Vercel's project settings:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | ✅ | Password for the built-in `admin` account |
| `MAX_BOT_TOKEN` | ✅ | Token from the [Max developer portal](https://dev.max.ru) |
| `SECRET_KEY` | ⬜ | Random string ≥ 32 chars for JWTs — auto-filled from `rezaryad_SUPABASE_JWT_SECRET` if absent |
| `CRON_SECRET` | ⬜ | Random secret to protect the `/api/admin/cron/*` endpoints |
| `CORS_ORIGINS` | ⬜ | Leave empty — frontend and backend share the same domain |

> **Supabase** — Connect the Supabase integration in the Vercel dashboard. It
> automatically injects `rezaryad_POSTGRES_PRISMA_URL`,
> `rezaryad_POSTGRES_URL_NON_POOLING`, etc.  `DATABASE_URL` and
> `DIRECT_DATABASE_URL` are resolved from those automatically (see
> `backend/app/config.py`). You do **not** need to set `DATABASE_URL` manually.
>
> **`NEXT_PUBLIC_API_URL`** — Do **not** set this in the Vercel project.  The
> frontend uses relative `/api/*` paths; Vercel routes them to the Python
> serverless function on the same domain.

3. Deploy. Vercel will:
   - Build the Next.js frontend from `frontend/`
   - Build the Python serverless function from `api/index.py`
   - Run `prisma generate` to create the Prisma Python client
   - On first cold-start, `apply_schema()` runs `prisma db push` to create all DB tables
   - `seed_admin()` creates the `admin` user from `ADMIN_PASSWORD`

4. **Background tasks** run via Vercel Cron Jobs (configured in `vercel.json`):

| Endpoint | Schedule | Task |
|---|---|---|
| `/api/admin/cron/expire-bookings` | every minute | Expire past-due bookings |
| `/api/admin/cron/check-open-doors` | every 10 min | Remind users with door open > 10 min |
| `/api/admin/cron/check-double-rentals` | every 5 min | Remind couriers with 2+ active sessions |
| `/api/admin/cron/check-anomalies` | every 10 min | Alert admin about sessions > 2 hours |

> Vercel Cron Jobs are available on the Hobby plan and above.

The admin panel URL (e.g., `https://rezaryad.vercel.app/login`) is what operators
open in a browser.  The same domain is used as the **Mini App URL** in Max.

---

### Alternative: Separate backend + Vercel frontend

If you prefer to host the Python backend on a VPS, Railway, or Render:

- Deploy the `backend/` directory and set all env vars from `backend/.env.example`.
- Run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- In Vercel, import only the `frontend/` directory and set  
  `NEXT_PUBLIC_API_URL=https://your-backend-domain.com` in the Vercel project.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin login returns 401 | Wrong password, or `ADMIN_PASSWORD` not set | Set `ADMIN_PASSWORD` in `backend/.env` (local) or Vercel env settings and restart |
| Admin login returns 422 | Old frontend sending `username` instead of `login` | Pull latest frontend code |
| Bot does not respond | Webhook not registered, or wrong `MAX_BOT_TOKEN` | Re-register webhook (step 7) |
| Mini-app auth returns 401 "Invalid initData signature" | `MAX_BOT_TOKEN` mismatch | Ensure backend uses the same token as the registered bot |
| `DATABASE_URL` errors | DB not running or wrong credentials | Check PostgreSQL connection string; on Vercel, verify the Supabase integration is connected |
| Vercel build fails — "module 'prisma' not found" | `prisma generate` didn't run | Check the `installCommand` in `vercel.json`; ensure `api/requirements.txt` exists |
| Frontend calls fail on Vercel with 404 | `NEXT_PUBLIC_API_URL` set to wrong value | Remove `NEXT_PUBLIC_API_URL` from Vercel env — use relative URLs (default) |
| Cron jobs not running | Not on a Vercel plan that supports Cron | Enable Vercel Cron or upgrade plan |
