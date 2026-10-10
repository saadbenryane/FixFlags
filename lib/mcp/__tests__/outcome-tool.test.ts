import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'

const stubs = vi.hoisted(() => ({
  loadSiteRecord: vi.fn(),
  listSiteOutcomes: vi.fn(),
  loadSiteOutcomeDetail: vi.fn(),
  mcpOutcomePayload: vi.fn(),
  latestAudit: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  checkResults: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/db', () => ({ prisma: { audit: { findFirst: stubs.latestAudit } } }))
vi.mock('@/lib/sites/application/check-results', () => ({ loadSiteCheckResults: stubs.checkResults }))

vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: stubs.loadSiteRecord }))
vi.mock('@/lib/sites/outcomes', () => ({
  listSiteOutcomes: stubs.listSiteOutcomes,
  loadSiteOutcomeDetail: stubs.loadSiteOutcomeDetail,
}))
vi.mock('@/lib/mcp/outcome-payload', () => ({ mcpOutcomePayload: stubs.mcpOutcomePayload }))

import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'

describe('MCP Outcome tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the enriched tenant-scoped projection and omits generic Outcomes', async () => {
    const handlers = new Map<string, (input: Record<string, unknown>) => Promise<unknown>>()
    const server = {
      registerTool(name: string, _definition: unknown, handler: (input: Record<string, unknown>) => Promise<unknown>) {
        handlers.set(name, handler)
      },
    } as unknown as McpServer
    const site = { kind: 'project', siteId: 'site-1', projectId: 'site-1', userId: 'user-1' }
    const detail = { id: 'outcome-1', limitation: 'Reset did not finish.' }
    const projected = {
      outcomeId: 'outcome-1',
      freshness: { status: 'INCONCLUSIVE' },
      limitation: 'Reset did not finish.',
      recoveryAction: 'Repair the reset hook and verify again.',
      methods: [{ evidenceSummary: 'FixFlags could not reset the synthetic account.' }],
    }
    stubs.loadSiteRecord.mockResolvedValue(site)
    stubs.listSiteOutcomes.mockResolvedValue([
      { id: 'outcome-1', kind: 'SIGNUP' },
      { id: 'outcome-generic', kind: 'GENERIC' },
    ])
    stubs.loadSiteOutcomeDetail.mockResolvedValue(detail)
    stubs.mcpOutcomePayload.mockReturnValue(projected)

    registerSiteOutcomeTools(server, { id: 'user-1' } as User)
    const handler = handlers.get(MCP_TOOLS.listOutcomes.name)
    expect(handler).toBeDefined()

    const result = await handler!({ siteId: 'site-1' }) as {
      structuredContent: { siteId: string; outcomes: unknown[] }
    }

    expect(stubs.loadSiteRecord).toHaveBeenCalledWith('site-1')
    expect(stubs.loadSiteOutcomeDetail).toHaveBeenCalledTimes(1)
    expect(stubs.loadSiteOutcomeDetail).toHaveBeenCalledWith(site, 'outcome-1')
    expect(stubs.mcpOutcomePayload).toHaveBeenCalledWith(detail)
    expect(result.structuredContent).toEqual({ siteId: 'site-1', outcomes: [projected], checkResults: [] })
    expect(stubs.checkResults).toHaveBeenCalledWith(site, 'audit-1')
  })
})
