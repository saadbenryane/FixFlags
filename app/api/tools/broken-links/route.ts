import { NextRequest, NextResponse } from 'next/server'
import { findBrokenLinks } from '@/lib/tools/broken-links'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Each check requests up to 40 pages on the target site, so the allowance is lower than other tools.
    await enforceRateLimit({ scope: 'tool-broken-links', identifier: requestClientId(req.headers), limit: 6, windowSeconds: 60 })
    const body = await req.json().catch(() => null) as { url?: unknown } | null
    if (!body || typeof body.url !== 'string' || !body.url.trim()) return apiError('URL is required', 400)
    return NextResponse.json(await findBrokenLinks(body.url))
  } catch (error) {
    return handleRouteError(error, 'Failed to check links')
  }
}
