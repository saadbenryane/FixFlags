import { apiError } from '@/lib/api/errors'
import { requireSiteOwner } from './request-access'
import { loadSiteRecord } from './ensure-site'
import { validateApiKey } from '@/lib/mcp/tools'
import { extractMcpCredential } from '@/lib/mcp/auth'
import { credentialAllows } from '@/lib/mcp/oauth'

/** Explicit credentials cannot borrow a browser session or another audience. */
export async function requireRepairReader(request: Request, siteId: string) {
  if (!request.headers.has('authorization') && !request.headers.has('x-api-key')) {
    const access = await requireSiteOwner(siteId)
    return access.ok ? { ok: true as const, site: access.decision.site }
      : { ok: false as const, response: apiError(access.message, access.status) }
  }
  const credential = extractMcpCredential(request.headers)
  if (!credential.ok) return { ok: false as const, response: apiError(credential.message, 401, { code: credential.code }) }
  const access = await validateApiKey(credential.key)
  if (!access) return { ok: false as const, response: apiError('Provide a valid FixFlags developer key.', 401, { code: 'INVALID_API_KEY' }) }
  if (access.apiKey.audience) return { ok: false as const, response: apiError('Use this MCP access token through fixflags.get_flag.', 403, { code: 'INVALID_AUDIENCE' }) }
  if (!credentialAllows(access.apiKey, 'flags:read')) return { ok: false as const, response: apiError('This key needs Flag evidence access.', 403, { code: 'INSUFFICIENT_SCOPE' }) }
  const site = await loadSiteRecord(siteId)
  if (!site?.projectId || site.userId !== access.user.id) return { ok: false as const, response: apiError('Site not found', 404) }
  return { ok: true as const, site }
}
