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

### Backend (any VPS / Railway / Render)

- Set all environment variables from `backend/.env.example`.
- Run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Make sure the server is reachable over HTTPS for the Max webhook.

### Frontend (Vercel)

- Import the `frontend/` directory as a Next.js project.
- Set `NEXT_PUBLIC_API_URL` to your backend's public HTTPS URL in Vercel's environment settings.
- Deploy.

The admin panel URL (e.g., `https://rezaryad.vercel.app/login`) is what operators open in a browser.
The same domain is used as the **Mini App URL** in Max, so couriers can open it inside the messenger.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin login returns 401 | Wrong password, or `ADMIN_PASSWORD` not set | Set `ADMIN_PASSWORD` in `backend/.env` and restart the server |
| Admin login returns 422 | Old frontend sending `username` instead of `login` | Pull latest frontend code |
| Bot does not respond | Webhook not registered, or wrong `MAX_BOT_TOKEN` | Re-register webhook (step 7) |
| Mini-app auth returns 401 "Invalid initData signature" | `MAX_BOT_TOKEN` mismatch | Ensure backend uses the same token as the registered bot |
| `DATABASE_URL` errors | DB not running or wrong credentials | Check PostgreSQL connection string |
