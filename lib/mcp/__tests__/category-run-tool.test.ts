import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import { MCP_TOOLS } from '../tool-manifest'
import type { z } from 'zod'
const mocks = vi.hoisted(() => ({ site: vi.fn(), run: vi.fn(), outcomes: vi.fn() }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun: mocks.run, getOwnedRun: vi.fn() }))
vi.mock('@/lib/sites/outcomes', () => ({ listSiteOutcomes: mocks.outcomes }))
import { registerSiteOutcomeTools } from '../tools/sites'
describe('MCP category run contract', () => {
  let schema: z.ZodType, handler: (input: never) => Promise<unknown>
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.site.mockResolvedValue({ siteId: 'site', projectId: 'project', userId: 'owner' })
    mocks.run.mockResolvedValue({ runId: 'run', outcomeIds: [], reused: false })
    mocks.outcomes.mockResolvedValue([])
    registerSiteOutcomeTools({ registerTool(name: string, definition: { inputSchema: z.ZodType }, callback: typeof handler) {
      if (name === MCP_TOOLS.run.name) { schema = definition.inputSchema; handler = callback }
    } } as unknown as McpServer, { id: 'owner' } as User)
  })
  it('uses the same scoped command and does not derive unrelated Outcomes', async () => {
    await handler(schema.parse({ siteId: 'site', scope: 'category', area: 'search', idempotencyKey: 'category-once' }) as never)
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project', scope: 'CATEGORY', categoryArea: 'search', source: 'MCP', outcomeIds: [] }))
    expect(mocks.outcomes).not.toHaveBeenCalled()
  })
  it('keeps the existing default Outcome selection contract', async () => {
    mocks.outcomes.mockResolvedValue([{ id: 'checkout', enabled: true, criticality: 'CRITICAL', bindings: [{ required: true }] }])
    await handler(schema.parse({ siteId: 'site', idempotencyKey: 'outcome-once' }) as never)
    expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ scope: 'OUTCOMES', outcomeIds: ['checkout'] }))
  })
  it('rejects unsupported areas or mixed responsibilities before invoking a command', () => {
    for (const input of [{ scope: 'category' }, { scope: 'category', area: 'uptime' }, { scope: 'site', area: 'search' }, { scope: 'category', area: 'search', outcomeIds: ['checkout'] }])
      expect(schema.safeParse({ siteId: 'site', idempotencyKey: 'same-request', ...input }).success).toBe(false)
  })
})
