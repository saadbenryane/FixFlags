import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import type { User } from '@prisma/client'
import type { z } from 'zod'
import { MCP_TOOLS } from '../tool-manifest'
import { repairFlag, repairObservations } from '@/lib/sites/__tests__/fixtures/repair-brief'
import { buildSiteRepairBrief, buildSiteRepairHandoff } from '@/lib/sites/repair-brief'

const mocks = vi.hoisted(() => ({ site: vi.fn(), flag: vi.fn(), evidence: vi.fn() }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.flag }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'https://fixflags.test' }))
vi.mock('@/lib/sites/application/repair-evidence', () => ({ loadSiteRepairEvidence: mocks.evidence }))
import { registerSiteOutcomeTools } from '../tools/sites'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'

type Handler = (input: { siteId: string; flagId: string; expectedContextHash?: string; observationOffset?: number; includeEvidence?: boolean }) => Promise<{
  structuredContent: Record<string, unknown>; isError?: boolean; content: Array<{ type: string; data?: string; text?: string }>
}>
describe('canonical repair context through MCP', () => {
  let handler: Handler
  let schema: z.ZodType
  let outputSchema: z.ZodType
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.site.mockResolvedValue({ siteId: 'site', projectId: 'site', userId: 'owner' })
    mocks.flag.mockResolvedValue(repairFlag())
    registerSiteOutcomeTools({ registerTool(name: string, definition: { inputSchema: z.ZodType; outputSchema: z.ZodType }, registered: Handler) {
      if (name === MCP_TOOLS.getFlag.name) { handler = registered; schema = definition.inputSchema; outputSchema = definition.outputSchema }
    } } as unknown as McpServer, { id: 'owner' } as User)
  })
  it('returns the exact task and context revision copied from the web product', async () => {
    const copied = await loadSiteFlagCopyTask('site', 'original')
    const expected = buildSiteRepairBrief('site', repairFlag(), 'https://fixflags.test')
    expect(schema.safeParse(expected.retrieval.mcp.arguments).success).toBe(true)
    const result = await handler(expected.retrieval.mcp.arguments)
    expect(result.structuredContent.repairBrief).toEqual(expected)
    expect(outputSchema.safeParse(result.structuredContent).success).toBe(true)
    const handoff = buildSiteRepairHandoff('site', repairFlag(), 'https://fixflags.test')
    expect(handoff.prompt).toBe(copied.prompt)
    expect(handoff.promptHash).toBe(copied.promptHash)
    expect(result.structuredContent.flag).toMatchObject({ flagId: 'incident', sourceAuditId: 'scan' })
  })
  it('attaches images as native MCP content rather than embedding bytes in JSON text', async () => {
    const image = Buffer.from('controlled image fixture')
    const evidence = { sourceAuditId: 'scan', sourceFlagId: 'original', performanceMeasurements: [], capture: {
      state: 'available', sha256: 'a'.repeat(64), bytes: image.length, mimeType: 'image/png',
      findingId: 'finding', pageUrl: 'https://example.com/checkout',
      findingRecordedAt: '2026-10-29T10:00:00.000Z', url: 'https://fixflags.test/private-capture', nativeImage: true } }
    mocks.evidence.mockResolvedValue({ evidence, image })
    const brief = buildSiteRepairBrief('site', repairFlag(), 'https://fixflags.test')
    const result = await handler(brief.retrieval.evidence.arguments)
    expect(result.structuredContent.repairBrief).toEqual({ ...brief, evidence })
    expect(result.content).toHaveLength(2)
    expect(result.content[1]).toMatchObject({ type: 'image', data: image.toString('base64') })
    expect(result.content[0].text).not.toContain(image.toString('base64'))
    expect(outputSchema.safeParse(result.structuredContent).success).toBe(true)
    mocks.evidence.mockResolvedValue({ evidence: { ...evidence, capture: { ...evidence.capture, nativeImage: false } }, image })
    const artifactOnly = await handler(brief.retrieval.evidence.arguments)
    expect(artifactOnly.content).toHaveLength(1)
    expect(artifactOnly.structuredContent.repairBrief).toMatchObject({ evidence: { capture: { nativeImage: false, url: evidence.capture.url } } })
    mocks.evidence.mockClear()
    await handler({ ...brief.retrieval.evidence.arguments, expectedContextHash: 'b'.repeat(64) })
    expect(mocks.evidence).not.toHaveBeenCalled()
  })
  it('returns validated continuation requests and refuses unpinned pages', async () => {
    mocks.flag.mockResolvedValue(repairFlag({ supportingObservations: repairObservations(65) }))
    const first = buildSiteRepairBrief('site', repairFlag({ supportingObservations: repairObservations(65) }), 'https://fixflags.test')
    expect(schema.safeParse({ siteId: 'site', flagId: 'original', observationOffset: 25 }).success).toBe(false)
    const next = first.retrieval.next!.arguments
    expect(schema.safeParse(next).success).toBe(true)
    const result = await handler(next)
    expect(outputSchema.safeParse(result.structuredContent).success).toBe(true)
    expect(result.structuredContent.repairBrief).toMatchObject({ contextHash: first.contextHash,
      observationPage: { offset: 25, returned: 25, total: 65 } })
    mocks.flag.mockResolvedValue(repairFlag())
    expect((await handler(next)).structuredContent).toMatchObject({ error: { code: 'REPAIR_CONTEXT_CHANGED', action: 'prepare_new_prompt' } })
  })
  it('rejects changes through both the copied-task hash and MCP revision', async () => {
    const copied = await loadSiteFlagCopyTask('site', 'original')
    const expected = buildSiteRepairBrief('site', repairFlag(), 'https://fixflags.test')
    mocks.flag.mockResolvedValue(repairFlag({ verificationRule: 'Changed acceptance' }))
    const result = await handler(expected.retrieval.mcp.arguments)
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ error: { code: 'REPAIR_CONTEXT_CHANGED' } })
    expect(result.structuredContent.repairBrief).toBeUndefined()
    await expect(loadSiteFlagCopyTask('site', 'original', copied.promptHash)).rejects.toMatchObject({ status: 409, code: 'REPAIR_TASK_CHANGED' })
  })
  it('retains the requested incident scope instead of substituting the narrower source Flag scope', async () => {
    mocks.flag.mockImplementation(async (_site, id) => repairFlag({ affectedPaths: id === 'incident'
      ? ['https://example.com/checkout', 'https://example.com/cart'] : ['https://example.com/checkout'] }))
    const copied = await loadSiteFlagCopyTask('site', 'incident')
    expect(copied.referenceFlagId).toBe('incident')
    const brief = buildSiteRepairBrief('site', repairFlag(), 'https://fixflags.test', 'incident')
    expect(brief.retrieval.mcp.arguments.flagId).toBe('incident')
    const result = await handler(brief.retrieval.mcp.arguments)
    expect(result.isError).not.toBe(true)
    expect(result.structuredContent.repairBrief).toEqual(brief)
    expect((await handler({ ...brief.retrieval.mcp.arguments, flagId: 'original' })).isError).toBe(true)
  })
  it('checks ownership before reading Flag context', async () => {
    mocks.site.mockResolvedValue({ siteId: 'site', projectId: 'site', userId: 'other' })
    expect((await handler({ siteId: 'site', flagId: 'original' })).isError).toBe(true)
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('does not invent a task when evidence is unreadable', async () => {
    mocks.flag.mockResolvedValue(repairFlag({ supportingEvidenceUnreadable: true }))
    expect((await handler({ siteId: 'site', flagId: 'original' })).structuredContent.repairBrief).toMatchObject({ repair: { readiness: 'unavailable', guidance: null } })
    await expect(loadSiteFlagCopyTask('site', 'original')).rejects.toMatchObject({ status: 422 })
  })
})
