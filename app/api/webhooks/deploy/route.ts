import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiKey } from '@/lib/mcp/tools'
import { credentialAllows } from '@/lib/mcp/oauth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { resolveWebhookApiKey, resolveWebhookCheckUrl } from '@/lib/webhooks/webhook-auth'
import { DeployCheckRefusal, requestDeployCheck } from '@/lib/sites/application/deploy-check'

/** Body is optional; every field is bounded. Unknown fields are refused rather than ignored. */
const bodySchema = z.object({
  url: z.string().url().max(2048).optional(),
  deployment: z.string().trim().min(1).max(120).regex(/^[\w.:/@-]+$/).optional(),
}).strict()

/**
 * Generic deploy hook for any host or CI: POST after a production deploy with a FixFlags API key
 * that may start checks. Works from GitHub Actions, Vercel, Netlify or a shell script.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('apiKey')?.trim()) return apiError('Send the FixFlags API key in the Authorization header.', 401)
    const credential = await validateApiKey(resolveWebhookApiKey(req))
    if (!credential) return apiError('Valid FixFlags API key required in the Authorization header.', 401)
    if (credential.apiKey.audience) return apiError('Deployment checks use a FixFlags API key, not an MCP access token.', 403)
    if (!credentialAllows(credential.apiKey, 'runs:write')) return apiError('This API key cannot start checks. Create a key that can run checks.', 403)

    const text = await req.text()
    const parsed = bodySchema.safeParse(text.trim() ? (() => { try { return JSON.parse(text) } catch { return null } })() : {})
    if (!parsed.success) return apiError('Send JSON with an optional url and deployment id.', 400)
    const checkUrl = parsed.data.url ?? resolveWebhookCheckUrl(req)
    if (!checkUrl) return apiError('Check URL required. Send url in the body or the x-fixflags-check-url header.', 400)
    const normalized = normalizeAuditNavigationUrl(checkUrl)
    if (!normalized.ok) return apiError(normalized.error, 400)

    const result = await requestDeployCheck({ userId: credential.user.id, url: normalized.url, deployment: parsed.data.deployment ?? null })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof DeployCheckRefusal) return apiError(error.message, error.status)
    return handleRouteError(error)
  }
}
