import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { validateApiKey, findFirst, requestSiteRun, loadOwnedRunRequestByKey } = vi.hoisted(() => ({
  validateApiKey: vi.fn(), findFirst: vi.fn(), requestSiteRun: vi.fn(), loadOwnedRunRequestByKey: vi.fn(),
}))
vi.mock('@/lib/mcp/tools', () => ({ validateApiKey }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst } } }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun }))
vi.mock('@/lib/sites/application/run-request-keys', () => ({ loadOwnedRunRequestByKey }))
import { POST } from '../route'

const key = (scopes: string[], audience: string | null = null) => ({ user: { id: 'owner' }, apiKey: { id: 'k', client: 'cli', scopes, audience } })
function call(init: { headers?: Record<string, string>; body?: string; query?: string } = {}) {
  return POST(new NextRequest(`http://localhost/api/webhooks/deploy${init.query ?? ''}`, {
    method: 'POST', headers: { authorization: 'Bearer ff_live_test', ...init.headers }, body: init.body ?? '{"url":"https://shop.example.com","deployment":"gh-123"}',
  }))
}

describe('POST /api/webhooks/deploy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateApiKey.mockResolvedValue(key(['sites:read', 'runs:write']))
    findFirst.mockResolvedValue({ id: 'project-1', siteOutcomes: [] })
    loadOwnedRunRequestByKey.mockResolvedValue(null)
    requestSiteRun.mockResolvedValue({ runId: 'run-1', auditId: 'audit-1', outcomeIds: [], reused: false })
  })

  it('refuses missing, query-string, MCP and read-only credentials before touching a Site', async () => {
    validateApiKey.mockResolvedValueOnce(null)
    expect((await call()).status).toBe(401)
    expect((await call({ query: '?apiKey=ff_live_test' })).status).toBe(401)
    validateApiKey.mockResolvedValueOnce(key(['runs:write'], 'https://fixflags.com/api/mcp'))
    expect((await call()).status).toBe(403)
    validateApiKey.mockResolvedValueOnce(key(['sites:read', 'runs:read', 'flags:read']))
    expect((await call()).status).toBe(403)
    expect(findFirst).not.toHaveBeenCalled()
    expect(requestSiteRun).not.toHaveBeenCalled()
  })

  it('validates the body and needs a check URL', async () => {
    expect((await call({ body: '{"url":"https://shop.example.com","extra":true}' })).status).toBe(400)
    expect((await call({ body: '{"deployment":"bad id with spaces"}' })).status).toBe(400)
    expect((await call({ body: 'not json' })).status).toBe(400)
    expect((await call({ body: '' })).status).toBe(400)
    expect(requestSiteRun).not.toHaveBeenCalled()
  })

  it('rechecks the whole Site even when it has enabled Outcomes', async () => {
    findFirst.mockResolvedValue({ id: 'project-1', siteOutcomes: [{ id: 'o1' }] })
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, siteId: 'project-1', runId: 'run-1', mode: 'site' })
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'owner', canonicalHost: 'shop.example.com' }) }))
    expect(requestSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', scope: 'SITE', outcomeIds: [], source: 'DEPLOYMENT', idempotencyKey: 'deploy:gh-123:site' }))
  })

  it('accepts the URL from the header for callers without a deployment ID', async () => {
    const res = await call({ body: '', headers: { 'x-fixflags-check-url': 'https://shop.example.com/' } })
    expect(res.status).toBe(200)
    expect(requestSiteRun).toHaveBeenCalledWith(expect.objectContaining({ scope: 'SITE', outcomeIds: [], source: 'DEPLOYMENT', idempotencyKey: undefined }))
    expect(loadOwnedRunRequestByKey).not.toHaveBeenCalled()
  })

  it.each(['site', 'outcomes'] as const)('replays a %s receipt even after the enabled Outcomes change', async mode => {
    loadOwnedRunRequestByKey.mockImplementation(async ({ idempotencyKey }) => idempotencyKey === `deploy:gh-123:${mode}`
      ? { id: 'recorded-run', auditId: 'recorded-audit' } : null)
    for (const siteOutcomes of [[{ id: 'o1' }], []]) {
      findFirst.mockResolvedValue({ id: 'project-1', siteOutcomes })
      const res = await call()
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ runId: 'recorded-run', auditId: 'recorded-audit', reused: true, mode })
    }
    expect(loadOwnedRunRequestByKey).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', userId: 'owner', source: 'DEPLOYMENT' }))
    expect(requestSiteRun).not.toHaveBeenCalled()
  })

  it('reports an unknown host as not found', async () => {
    findFirst.mockResolvedValue(null)
    expect((await call()).status).toBe(404)
    expect(requestSiteRun).not.toHaveBeenCalled()
  })
})
