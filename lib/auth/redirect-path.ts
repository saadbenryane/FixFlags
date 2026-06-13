import { headers } from 'next/headers'

/** Path + query for post-login redirect (set by middleware). */
export async function getRequestedPath(fallback = '/dashboard'): Promise<string> {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname')
  if (!pathname || pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
    return fallback
  }
  return pathname
}

export function signInUrl(nextPath: string): string {
  return `/sign-in?next=${encodeURIComponent(nextPath)}`
}
