import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: process.env.GOOGLE_CLIENT_ID ? 'true' : '',
    NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: process.env.GITHUB_CLIENT_ID ? 'true' : '',
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
}

export default nextConfig
