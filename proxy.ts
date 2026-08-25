import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isWwwApexPair, siteHostname } from '@/lib/http/site-host'

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/admin/') || pathname.startsWith('/settings/')
}

const PARKED_POWER_TOOL_PREFIXES = [
  '/report/repo',
  '/dashboard/mcp-analytics',
  '/dashboard/mcp-setup',
  '/settings/integrations',
  '/settings/api-keys',
  '/onboarding/plans',
  '/cli/authorize',
  '/docs/integrations',
  '/docs/cli',
  '/docs/mcp',
  '/help/mcp',
  '/help/mcp-and-editors',
  '/api/api-keys',
  '/api/cli',
  '/api/integrations/github',
  '/api/mcp',
  '/api/repo-scans',
  '/api/webhooks/railway',
  '/api/well-known/mcp-json',
  '/.well-known/mcp.json',
  '/.well-known/mcp-server.json',
  '/.well-known/skills/fixflags',
] as const

export function isParkedPowerToolPath(pathname: string): boolean {
  return PARKED_POWER_TOOL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * Edge-safe presence check for the better-auth session cookie. Middleware runs
 * on the edge runtime, so it must NOT import '@/lib/auth' (that pulls Prisma /
 * node:path into the edge bundle and crashes at runtime). This is only a UX
 * gate to bounce logged-out users to sign-in; every protected page/route still
 * validates the session server-side, so a present-but-invalid cookie is caught
 * there. Matches both the dev name (`better-auth.session_token`) and the
 * production `__Secure-`/`__Host-` prefixed variants.
 */
function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.endsWith('better-auth.session_token') && c.value.length > 0)
}

function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const csp = [
    "default-src 'self'",
    // 'unsafe-eval' is required by GTM in dev but should NOT be in production
    // 'unsafe-inline' is needed for inline styles from Tailwind/next-themes
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://*.stripe.com https://js.stripe.com https://www.googletagmanager.com https://static.cloudflareinsights.com https://connect.facebook.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    // ws://localhost:* only needed for dev hot-reload WebSocket
    `connect-src 'self' https://*.stripe.com https://api.stripe.com https://*.resend.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com https://www.facebook.com https://connect.facebook.net${isDev ? ' ws://localhost:*' : ''}`,
    "frame-src https://*.stripe.com https://js.stripe.com https://www.facebook.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return csp
}

export async function middleware(request: NextRequest) {
  if (isParkedPowerToolPath(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404 })
  }

  const canonicalHost = siteHostname()
  const requestHost = request.nextUrl.hostname
  if (
    canonicalHost &&
    requestHost !== canonicalHost &&
    isWwwApexPair(requestHost, canonicalHost)
  ) {
    const url = request.nextUrl.clone()
    url.hostname = canonicalHost
    url.protocol = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || request.url).protocol
    return NextResponse.redirect(url, 308)
  }

  const requestHeaders = new Headers(request.headers)
  const pathname = request.nextUrl.pathname + request.nextUrl.search
  requestHeaders.set('x-pathname', pathname)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  response.headers.set('Content-Security-Policy', buildCsp())
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  )

  if (isProtectedPath(request.nextUrl.pathname) && !hasSessionCookie(request)) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/api/api-keys/:path*',
    '/api/cli/:path*',
    '/api/integrations/github/:path*',
    '/api/mcp/:path*',
    '/api/repo-scans/:path*',
    '/api/webhooks/railway/:path*',
    '/api/well-known/mcp-json/:path*',
    // Skip API routes, static assets, and images
    '/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
