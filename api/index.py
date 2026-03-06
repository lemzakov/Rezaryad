"""
Vercel serverless entry point for the FastAPI backend.

Vercel's @vercel/python builder discovers this file and serves the FastAPI
ASGI app at /api/* on the same deployment as the Next.js frontend.

Routing (see vercel.json):
  /api/*  → this Python serverless function (FastAPI)
  /*      → Next.js frontend (from frontend/)

This eliminates the need for cross-origin requests: the browser talks to a
single domain, Vercel routes internally.
"""
import sys
import os

# Make the backend package importable: `from app.xxx import yyy`
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the FastAPI app — Vercel detects the `app` variable as the ASGI handler.
from app.main import app  # noqa: F401
