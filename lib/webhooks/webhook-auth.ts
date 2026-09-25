import type { NextRequest } from 'next/server'

export function resolveWebhookApiKey(req: NextRequest): string | null {
  if (req.nextUrl.searchParams.get('apiKey')?.trim()) return null
  const authorization = req.headers.get('authorization')?.trim() ?? ''
  const bearer = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
  const fromHeader = req.headers.get('x-fixflags-api-key')?.trim()
  if (bearer && fromHeader && bearer !== fromHeader) return null
  return bearer || fromHeader || null
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
  if (req.nextUrl.searchParams.get('webhookSecret')?.trim()) return false
  const provided = req.headers.get('x-fixflags-webhook-secret')?.trim() ?? null
  return provided === expected
}
