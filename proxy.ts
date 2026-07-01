import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith('/admin/') || pathname.startsWith('/settings/')
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

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  const pathname = request.nextUrl.pathname + request.nextUrl.search
  requestHeaders.set('x-pathname', pathname)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.stripe.com https://js.stripe.com https://www.googletagmanager.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' blob: data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.stripe.com https://api.stripe.com https://*.resend.com https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://cloudflareinsights.com ws://localhost:*",
    "frame-src https://*.stripe.com https://js.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', csp)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
