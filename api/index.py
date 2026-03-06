"""
Vercel serverless entry point for the FastAPI backend.

Vercel's Python runtime discovers this file and serves the FastAPI ASGI app
at /api/* on the same deployment as the Next.js frontend.

Routing (see vercel.json → "rewrites"):
  /api/:path*  → this Python serverless function (FastAPI)
  /*           → Next.js frontend (from frontend/)

When Vercel processes a rewrite, the ORIGINAL request path is forwarded to the
ASGI app — NOT the destination path ("/api/index.py").  So a request to
  POST /api/admin/login
arrives at FastAPI as
  POST /api/admin/login
which matches the admin router's `prefix="/api/admin"` + `@router.post("/login")`.

This eliminates cross-origin requests: the browser talks to a single domain,
Vercel routes internally.
"""
import sys
import os

# Make the backend package importable: `from app.xxx import yyy`
# backend/ is included in the Lambda bundle via vercel.json `includeFiles: "backend/**"`.
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the FastAPI app — Vercel detects the `app` variable as the ASGI handler.
from app.main import app  # noqa: F401
