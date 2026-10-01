import path from 'node:path';
import type { NextConfig } from 'next';

const rawApiUrl = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';
const apiUrl = rawApiUrl.replace('://localhost:', '://127.0.0.1:');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  poweredByHeader: false,
  // The browser talks to the API through the same origin, so the refresh cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
