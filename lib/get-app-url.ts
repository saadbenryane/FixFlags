export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL (or BETTER_AUTH_URL) must be set in production')
    }
    return 'http://localhost:3000'
  }
  return url.replace(/\/$/, '')
}
