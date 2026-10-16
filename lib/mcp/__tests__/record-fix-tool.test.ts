import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { ImprovementAttemptConflict } from '@/lib/improvements/attempt-intent'
import type { z } from 'zod'

const mocks = vi.hoisted(() => ({ site: vi.fn(), record: vi.fn(), run: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { runRequest: { findFirst: mocks.run } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/application/flag-verification', () => ({ recordSiteFlagFix: mocks.record }))
import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'

type Result = { structuredContent: Record<string, unknown>; isError?: boolean }
type Handler = (input: Record<string, unknown>) => Promise<Result>
describe('MCP record_fix receipts', () => {
  let handler: Handler
  let verifySchema: z.ZodType
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.site.mockResolvedValue({ siteId: 'site', projectId: 'site', userId: 'owner' })
    mocks.run.mockResolvedValue({ id: 'run' })
    const server = { registerTool(name: string, definition: { inputSchema: z.ZodType }, registered: Handler) {
      if (name === MCP_TOOLS.recordFix.name) handler = registered
      if (name === MCP_TOOLS.verifyFlag.name) verifySchema = definition.inputSchema
    } } as unknown as McpServer
    registerSiteOutcomeTools(server, { id: 'owner' } as User)
  })
  it('returns an executable verification handoff with a stable key on every retry', async () => {
    mocks.record.mockResolvedValue({ siteId: 'site', flagId: 'flag', attemptId: 'attempt', outcome: null, verificationAuditId: null })
    const input = { siteId: 'site', flagId: 'flag', idempotencyKey: 'repair-key', changeSummary: 'Recorded repair' }
    const first = await handler(input), replay = await handler(input)
    const next = first.structuredContent.next as { tool: string; arguments: Record<string, unknown> }
    expect(next.tool).toBe(MCP_TOOLS.verifyFlag.name)
    expect(verifySchema.safeParse(next.arguments).success).toBe(true)
    expect(next.arguments.idempotencyKey).toBe('flag-verify:attempt')
    expect(replay.structuredContent.next).toEqual(next)
  })
  it.each(['recorded', 'admitted', 'completed'] as const)('returns stored provenance and the applicable next step: %s', async stage => {
    const receipt = { siteId: 'site', flagId: 'flag', attemptId: 'attempt', idempotencyKey: 'repair-key',
      commitReference: 'recorded-commit', changeSummary: 'Recorded repair', deploymentReference: 'recorded-deployment',
      verificationAuditId: stage === 'admitted' ? 'audit' : null, outcome: stage === 'completed' ? 'IMPROVED' : null }
    mocks.record.mockResolvedValue(receipt)
    const result = await handler({ siteId: 'site', flagId: 'flag', idempotencyKey: 'repair-key', changeSummary: 'Recorded repair', commit: 'recorded-commit' })
    expect(result.structuredContent).toMatchObject({ status: 'RECORDED', ...receipt, next: stage === 'admitted'
      ? { tool: MCP_TOOLS.getRun.name, arguments: { runId: 'run' } }
      : stage === 'completed' ? { tool: MCP_TOOLS.getFlag.name, arguments: { siteId: 'site', flagId: 'flag' } }
      : { tool: MCP_TOOLS.verifyFlag.name, arguments: { siteId: 'site', flagId: 'flag', attemptId: 'attempt' } } })
    expect(mocks.run).toHaveBeenCalledTimes(stage === 'admitted' ? 1 : 0)
    if (stage === 'admitted') expect(mocks.run).toHaveBeenCalledWith({ where: { auditId: 'audit', projectId: 'site' }, select: { id: true } })
  })
  it('refuses changed intent rather than returning a recorded success', async () => {
    mocks.record.mockRejectedValue(new ImprovementAttemptConflict())
    const result = await handler({ siteId: 'site', flagId: 'flag', idempotencyKey: 'repair-key', changeSummary: 'Changed repair' })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ status: 'ERROR', error: { code: 'FIX_INTENT_MISMATCH', action: 'use_new_request_key' } })
    expect(mocks.run).not.toHaveBeenCalled()
  })
})
