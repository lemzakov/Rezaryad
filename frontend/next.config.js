/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In local development the Next.js dev server (port 3000) and the FastAPI
    // backend (port 8000) run as separate processes.  Proxy /api/* to the
    // backend so the frontend can use the same relative paths in all environments.
    //
    // In production (single Vercel project) this rewrite is NOT applied:
    // vercel.json routes /api/* directly to the Python serverless function
    // before Next.js sees the request.
    if (process.env.NODE_ENV !== 'production') {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      return [
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }
    return [];
  },
};
module.exports = nextConfig;
