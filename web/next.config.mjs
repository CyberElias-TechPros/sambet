/** @type {import('next').NextConfig} */
const config = {
  // The API lives on Cloudflare Workers. In development the Worker runs on
  // 127.0.0.1:8787 (wrangler dev). On Vercel set NEXT_PUBLIC_API_PROXY_URL to
  // your deployed Worker URL. The browser always talks to SAME-ORIGIN /api/*,
  // which Vercel proxies — so cookies stay first-party and no CORS is needed.
  async rewrites() {
    const dest =
      process.env.NEXT_PUBLIC_API_PROXY_URL ?? 'http://127.0.0.1:8787';
    return [{ source: '/api/:path*', destination: `${dest}/api/:path*` }];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    // X-Frame-Options: DENY protects the registry in production, but it also
    // blocks embedding the app in dev preview environments (which render the
    // site inside an iframe), so it is only applied to production builds.
    const frameGuard = isProd
      ? [{ key: 'X-Frame-Options', value: 'DENY' }]
      : [];
    return [
      {
        source: '/:all*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          ...frameGuard,
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default config;
