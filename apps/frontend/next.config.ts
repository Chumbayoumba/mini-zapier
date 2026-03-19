import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    // Only proxy in dev — in production nginx handles /api routing
    if (apiUrl.startsWith('http')) {
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
