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
    return [
      {
        source: '/:all*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
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
