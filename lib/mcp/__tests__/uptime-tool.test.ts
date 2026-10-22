import { beforeEach, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import type { z } from 'zod'
import { MCP_TOOLS } from '../tool-manifest'
import { projectUptimeStatus } from '@/lib/uptime/status'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'

const stubs = vi.hoisted(() => ({ sites: vi.fn(), site: vi.fn(), outcomes: vi.fn(), latest: vi.fn(), results: vi.fn(), summary: vi.fn(), history: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findMany: stubs.sites } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: stubs.site }))
vi.mock('@/lib/sites/outcomes', () => ({ loadSiteOutcomeDetails: stubs.outcomes }))
vi.mock('@/lib/sites/application/site-execution', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/sites/application/site-execution')>(), resolveLatestAudit: stubs.latest,
}))
vi.mock('@/lib/sites/application/check-results', () => ({ loadSiteCheckResultPage: stubs.results }))
vi.mock('@/lib/uptime/queries', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/uptime/queries')>(), loadUptimeSummary: stubs.summary, loadUptimeHistory: stubs.history,
}))
import { registerSiteOutcomeTools } from '../tools/sites'
import { InvalidUptimeCursorError } from '@/lib/uptime/queries'

const now = new Date()
const project = { id: 'owned-project', url: 'https://example.com/', deletedAt: null, name: 'Example', canonicalHost: 'example.com',
  watchInterval: 'WEEKLY' as const, watchNextRunAt: now, user: { id: 'owner', lifecycleStatus: 'ACTIVE' as const }, siteOutcomes: [] }
const monitor = { targetUrl: project.url, state: 'offline', enabled: true, lastCheckedAt: now, nextProbeAt: now, confirmationDueAt: null }
const summary = { ...projectUptimeStatus(project, monitor, now), openIncidentCount: 1, segments: [] }
const handlers = new Map<string, { schema: z.ZodType; call: (input: never) => Promise<{ structuredContent: Record<string, unknown>; isError?: boolean }> }>()
beforeEach(() => {
  vi.clearAllMocks(); handlers.clear()
  stubs.sites.mockResolvedValue([{ ...project, uptimeMonitor: monitor }])
  stubs.site.mockResolvedValue({ kind: 'project', siteId: 'site-alias', projectId: project.id, userId: 'owner' })
  stubs.outcomes.mockResolvedValue([]); stubs.latest.mockResolvedValue(null)
  stubs.results.mockResolvedValue({ results: [], nextCursor: null }); stubs.summary.mockResolvedValue(summary)
  registerSiteOutcomeTools({ registerTool(name: string, definition: { inputSchema: z.ZodType }, call: (input: never) => Promise<never>) {
    handlers.set(name, { schema: definition.inputSchema, call })
  } } as unknown as McpServer, { id: 'owner' } as User)
})
async function call(name: string, input: unknown) {
  const tool = handlers.get(name)!
  return tool.call(tool.schema.parse(input) as never)
}

it('includes automatic uptime for every listed owned Site without per-Site history reads', async () => {
  const result = await call(MCP_TOOLS.listSites.name, {})
  expect(result.structuredContent.sites).toEqual([{ siteId: project.id, name: project.name, host: project.canonicalHost,
    outcomeCount: 0, watching: true, uptime: projectUptimeStatus(project, monitor, now) }])
  expect(stubs.sites).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner', deletedAt: null } }))
  expect(stubs.summary).not.toHaveBeenCalled(); expect(stubs.history).not.toHaveBeenCalled()
})

it('includes the shared summary by default without requiring configured Outcomes', async () => {
  const result = await call(MCP_TOOLS.listOutcomes.name, { siteId: 'site-alias' })
  expect(result.structuredContent).toMatchObject({ siteId: 'site-alias', outcomes: [], uptime: { ...summary, scope: UPTIME_COPY.scope, limitation: UPTIME_COPY.limitation } })
  expect(stubs.summary).toHaveBeenCalledWith(project.id)
  expect(stubs.history).not.toHaveBeenCalled()
})

it.each(['24h', '7d', '30d'] as const)('reads %s history only on request, scoped to the authorized project and independent result cursor', async window => {
  const history = { ...summary, window, probes: [{ id: 'probe-one', result: 'FAILED' }], incidents: [{ id: 'incident-one', recoveredAt: null }], nextCursor: 'probe-two' }
  stubs.history.mockResolvedValue(history)
  const result = await call(MCP_TOOLS.listOutcomes.name, { siteId: 'site-alias', uptimeWindow: window, uptimeCursor: 'probe-one', resultCursor: 'result-cursor' })
  expect(stubs.history).toHaveBeenCalledWith(project.id, window, 'probe-one')
  expect(stubs.summary).not.toHaveBeenCalled()
  expect(stubs.results).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id }), null, 'result-cursor')
  expect(result.structuredContent.uptime).toEqual({ ...history, scope: UPTIME_COPY.scope, limitation: UPTIME_COPY.limitation })
})

it('reports missing observations and paused care without treating either as successful probes', async () => {
  stubs.sites.mockResolvedValue([{ ...project, uptimeMonitor: null },
    { ...project, id: 'paused-site', watchInterval: null, uptimeMonitor: monitor }])
  const result = await call(MCP_TOOLS.listSites.name, {})
  expect(result.structuredContent.sites).toEqual([
    expect.objectContaining({ watching: true, uptime: expect.objectContaining({ enabled: true, state: 'unknown', lastCheckedAt: null }) }),
    expect.objectContaining({ watching: false, uptime: expect.objectContaining({ enabled: false, state: 'paused' }) }),
  ])
})

it('requires a bounded window for pagination and rejects malformed history inputs before reading', () => {
  const schema = handlers.get(MCP_TOOLS.listOutcomes.name)!.schema
  for (const input of [{ uptimeCursor: 'probe-one' }, { uptimeWindow: '1y' }, { uptimeWindow: '24h', uptimeCursor: 'bad cursor' }])
    expect(schema.safeParse({ siteId: 'site-alias', ...input }).success).toBe(false)
  expect(stubs.site).not.toHaveBeenCalled()
  expect(stubs.history).not.toHaveBeenCalled()
})

it('returns a restart action for an expired, foreign or superseded cursor instead of changing history scope', async () => {
  stubs.history.mockRejectedValue(new InvalidUptimeCursorError())
  const result = await call(MCP_TOOLS.listOutcomes.name, { siteId: 'site-alias', uptimeWindow: '24h', uptimeCursor: 'foreign-probe' })
  expect(result).toMatchObject({ isError: true, structuredContent: { status: 'ERROR', error: {
    code: 'INVALID_UPTIME_CURSOR', recoverable: true, action: 'restart_uptime_history',
  }, next: { tool: MCP_TOOLS.listOutcomes.name, arguments: { siteId: 'site-alias', uptimeWindow: '24h' } } } })
  const next = result.structuredContent.next as { arguments: unknown }
  expect(handlers.get(MCP_TOOLS.listOutcomes.name)!.schema.safeParse(next.arguments).success).toBe(true)
  expect(stubs.summary).not.toHaveBeenCalled()
  expect(stubs.history).toHaveBeenCalledTimes(1)
})

it.each([null, { kind: 'project', siteId: 'site-alias', projectId: 'foreign-project', userId: 'someone-else' }])('denies inaccessible Site evidence before reading uptime', async site => {
  stubs.site.mockResolvedValue(site)
  const result = await call(MCP_TOOLS.listOutcomes.name, { siteId: 'site-alias', uptimeWindow: '24h' })
  expect(result.isError).toBe(true)
  expect(stubs.outcomes).not.toHaveBeenCalled()
  expect(stubs.summary).not.toHaveBeenCalled(); expect(stubs.history).not.toHaveBeenCalled()
})
