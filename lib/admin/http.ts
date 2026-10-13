import { AdminActionError } from './errors'
export const adminPrivateHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}
export function requireAdminOrigin(request: Request) {
  const origin = request.headers.get('origin'),
    configured = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL].filter(
      (value): value is string => Boolean(value),
    )
  const trusted = configured.length ? configured : [request.url]
  if (!origin || !trusted.some((value) => new URL(value).origin === origin))
    throw new AdminActionError(
      'This action must originate from the admin workspace.',
      403,
      'INVALID_ORIGIN',
    )
}
