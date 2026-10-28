import { env } from 'node:process'

export function getAppUrl(): string {
  // Read Node's runtime environment. Next.js freezes public process.env
  // references, including optimized aliases, when the image is built.
  const url = env.NEXT_PUBLIC_APP_URL || env.BETTER_AUTH_URL
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL (or BETTER_AUTH_URL) must be set in production')
    }
    return 'http://localhost:3000'
  }
  return url.replace(/\/$/, '')
}
