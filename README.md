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
**one Vercel project** from the **repository root**.

#### How the build works

| Phase | Command | What it does |
|---|---|---|
| Install | `python3 -m pip install -r api/requirements.txt && cd frontend && npm install` | Installs Python deps + Node deps |
| Build | `(cd backend && python3 -m prisma generate) && (cd frontend && npm run build)` | Downloads Prisma query engine binary + builds Next.js |
| Function | `api/index.py` (Python 3.12 serverless) | FastAPI app serving all `/api/*` routes |
| Frontend | `frontend/.next` | Next.js admin panel served from CDN |

#### Step-by-step

1. **Import the repo root** (not `frontend/` or `backend/`) as a new Vercel project.
   - Framework Preset: **Other** (or Vercel auto-detects from `vercel.json`)
   - Root Directory: leave as `/` (repo root)

2. **Connect Supabase** via the Vercel Integrations dashboard.  The integration
   automatically injects `rezaryad_POSTGRES_PRISMA_URL` (pooled, for runtime queries)
   and `rezaryad_POSTGRES_URL_NON_POOLING` (direct, for schema migrations). The
   backend's `config.py` maps these to `DATABASE_URL` and `DIRECT_DATABASE_URL`
   automatically — **you do not need to set these manually**.

3. **Set Environment Variables** in Vercel project settings → Environment Variables:

   | Variable | Required | Description |
   |---|---|---|
   | `ADMIN_PASSWORD` | ✅ | Password for the built-in `admin` account (min 8 chars) |
   | `MAX_BOT_TOKEN` | ✅ | Bot token from the [Max developer portal](https://dev.max.ru) |
   | `SECRET_KEY` | ⬜ | Random ≥32-char string for JWT signing. Falls back to `rezaryad_SUPABASE_JWT_SECRET` (Supabase integration). |
   | `CRON_SECRET` | ⬜ | Secret for Vercel Cron auth. Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron request. |
   | `CORS_ORIGINS` | ⬜ | Leave **empty** — frontend and backend share one domain, no CORS needed. |
   | `NEXT_PUBLIC_API_URL` | ❌ | Do **not** set. Frontend uses relative `/api/*` paths; `vercel.json` routes them to the Python function on the same domain. |

4. **Deploy.** On every build Vercel:
   - Installs Python deps from `api/requirements.txt`
   - Runs `prisma generate` (downloads the Prisma PostgreSQL engine binary for Linux)
   - Builds the Next.js frontend; output goes to `frontend/.next/`
   - Packages `backend/**` source into the Lambda bundle (via `includeFiles`)
   - On first Lambda cold-start: `apply_schema()` runs `prisma db push` to create DB tables,
     then `seed_admin()` creates the `admin` user from `ADMIN_PASSWORD`

5. **Cron Jobs** — Vercel calls these endpoints on schedule (replaces APScheduler,
   which can't run in a stateless serverless environment):

   | Endpoint | Schedule | Task |
   |---|---|---|
   | `/api/admin/cron/expire-bookings` | every 5 min | Expire past-due bookings |
   | `/api/admin/cron/check-open-doors` | every 10 min | Remind users with door open > 10 min |
   | `/api/admin/cron/check-double-rentals` | every 5 min | Remind couriers with 2+ active sessions |
   | `/api/admin/cron/check-anomalies` | every 10 min | Alert admin about sessions > 2 hours |

   Cron Jobs require **Vercel Hobby plan or above**.

The admin panel URL (e.g., `https://rezaryad.vercel.app/login`) is what operators
open in a browser.  The same domain is used as the **Mini App URL** in Max.

> **Note on Lambda size:** The Prisma query engine binary is ~40 MB. Combined with
> other Python packages the Lambda may approach Vercel's 50 MB Hobby-plan limit.
> If the build fails with a size error, upgrade to the Pro plan (250 MB limit) or
> contact support to increase the limit.

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
| Admin login returns 401 | Wrong password, or `ADMIN_PASSWORD` not set | Set `ADMIN_PASSWORD` in Vercel env and redeploy |
| Admin login returns 422 | Old frontend sending `username` instead of `login` | Pull latest frontend code |
| Bot does not respond | Webhook not registered, or wrong `MAX_BOT_TOKEN` | Re-register webhook (step 7) |
| Mini-app auth returns 401 "Invalid initData signature" | `MAX_BOT_TOKEN` mismatch | Ensure backend uses the same token as the registered bot |
| `DATABASE_URL` errors | DB not running or wrong credentials | On Vercel: verify the Supabase integration is connected; check `rezaryad_POSTGRES_PRISMA_URL` is injected |
| Vercel build fails — `prisma generate` error | Missing `api/requirements.txt` or schema error | Check `backend/prisma/schema.prisma` parses cleanly; verify `api/requirements.txt` lists `prisma==0.13.1` |
| Vercel build fails — Lambda too large | Prisma binary + packages exceed the plan limit | Upgrade to Vercel Pro (250 MB Lambda limit) |
| API calls return 404 on Vercel | `NEXT_PUBLIC_API_URL` set to a wrong URL | Remove `NEXT_PUBLIC_API_URL` from Vercel env — the frontend uses relative paths by default |
| Cron jobs not running | Plan doesn't support Cron, or `CRON_SECRET` mismatch | Verify Vercel plan supports Cron Jobs; check `CRON_SECRET` matches what Vercel sends |
| `apply_schema` times out on cold start | Lambda timeout too short for `prisma db push` | `maxDuration: 60` is set in `vercel.json`; requires Vercel Pro |
