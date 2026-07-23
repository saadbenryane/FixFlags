import type { NextRequest } from 'next/server'

export function resolveWebhookApiKey(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get('apiKey')
  if (fromQuery?.trim()) return fromQuery.trim()
  const fromHeader = req.headers.get('x-fixflags-api-key')
  return fromHeader?.trim() || null
}

export function resolveWebhookCheckUrl(req: NextRequest): string | null {
  const fromQuery = req.nextUrl.searchParams.get('url')
  if (fromQuery?.trim()) return fromQuery.trim()
  const fromHeader = req.headers.get('x-fixflags-check-url')
  return fromHeader?.trim() || null
}

/** When RAILWAY_WEBHOOK_SECRET is set, callers must pass the same value. */
export function verifyWebhookSharedSecret(
  req: NextRequest,
  envName: 'RAILWAY_WEBHOOK_SECRET'
): boolean {
  const expected = process.env[envName]
  if (!expected) return true
  const provided =
    req.nextUrl.searchParams.get('webhookSecret')?.trim() ??
    req.headers.get('x-fixflags-webhook-secret')?.trim() ??
    null
  return provided === expected
}
