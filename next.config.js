/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(self), geolocation=(self)'
        }
      ]
    }
  ]
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- This config uses the repository's CommonJS format.
const { withSentryConfig } = require('@sentry/nextjs/config');
module.exports = withSentryConfig(nextConfig, { silent: true, disableLogger: true });
