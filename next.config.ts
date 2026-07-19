import type { NextConfig } from 'next'

// OAuth provider availability is resolved at runtime via GET /api/auth/providers
// (see hooks/useOAuthProviders), not baked in at build time. Build-time gating
// kept the buttons hidden in production because the OAuth credentials aren't
// present at `next build`, only as runtime env on the deployed service.

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/mcp.json',
        destination: '/api/well-known/mcp-json',
      },
    ]
  },
  serverExternalPackages: [
    'puppeteer',
    '@prisma/client',
    'prisma',
    'better-auth',
    'bullmq',
    'ioredis',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    '@aws-sdk/client-s3',
    'cheerio',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'sonner', 'swr'],
  },
}

export default nextConfig
