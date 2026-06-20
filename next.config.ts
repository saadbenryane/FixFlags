import type { NextConfig } from 'next'
import {
  isGoogleOAuthConfigured,
  isGithubOAuthConfigured,
} from './lib/auth/env'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: isGoogleOAuthConfigured() ? 'true' : '',
    NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: isGithubOAuthConfigured() ? 'true' : '',
  },
  poweredByHeader: false,
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
  experimental: {
    optimizePackageImports: ['lucide-react'],
    typedRoutes: true,
  },
}

export default nextConfig
