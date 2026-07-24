import type { NextConfig } from 'next'

// OAuth provider availability is resolved at runtime via GET /api/auth/providers
// (see hooks/useOAuthProviders), not baked in at build time. Build-time gating
// kept the buttons hidden in production because the OAuth credentials aren't
// present at `next build`, only as runtime env on the deployed service.

const nextConfig: NextConfig = {
  // Lets concurrent verification use an isolated output directory without
  // racing a developer's active `.next` process.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'standalone',
  // Sharp loads its platform libvips payload dynamically, so Next's static
  // tracer cannot discover the native files from imports alone.
  outputFileTracingIncludes: {
    '/*': ['node_modules/@img/sharp-libvips-*/**/*'],
  },
  poweredByHeader: false,
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.FIXFLAGS_DEV_ORIGIN ? [process.env.FIXFLAGS_DEV_ORIGIN] : []),
  ],
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
    'playwright',
    '@prisma/client',
    'prisma',
    'better-auth',
    '@better-auth/passkey',
    '@better-auth/core',
    'bullmq',
    'ioredis',
    '@anthropic-ai/sdk',
    '@modelcontextprotocol/sdk',
    '@aws-sdk/client-s3',
    'cheerio',
  ],
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [75, 82],
    // When localPatterns is set it becomes an allowlist. A screenshots-only
    // list previously returned 400 "url parameter is not allowed" for every
    // brand and marketing asset on production. Keep these prefixes in sync
    // with scripts/image-local-patterns-guard.mjs.
    localPatterns: [
      {
        pathname: '/api/screenshots/**',
      },
      {
        pathname: '/brand/**',
      },
      {
        pathname: '/marketing/**',
      },
    ],
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
