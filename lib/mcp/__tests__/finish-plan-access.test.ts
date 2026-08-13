import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  loadCompletedTaskOutcome: vi.fn(),
  isPublicMarketingSample: vi.fn(),
  assertAuditAccess: vi.fn(),
  assertMcpAccess: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.auditFindUnique },
    reportRubric: { findUnique: vi.fn() },
    flag: { findUnique: vi.fn(), update: vi.fn() },
    flagFeedback: { create: vi.fn() },
  },
}))
vi.mock('@/lib/audit/task-contracts', () => ({
  loadCompletedTaskOutcome: mocks.loadCompletedTaskOutcome,
}))
vi.mock('@/lib/audit/report-access', () => ({
  isPublicMarketingSample: mocks.isPublicMarketingSample,
}))
vi.mock('@/lib/mcp/access', () => ({
  assertAuditAccess: mocks.assertAuditAccess,
  assertMcpAccess: mocks.assertMcpAccess,
}))

import { registerAnonCheckStatusTools } from '@/lib/mcp/anon-check-status'
import { registerFlagTools } from '@/lib/mcp/tools/flags'

type ToolHandler = (input: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>
}>

function fakeServer() {
  const handlers = new Map<string, ToolHandler>()
  return {
    handlers,
    server: {
      tool(name: string, _description: string, _schema: unknown, handler: ToolHandler) {
        handlers.set(name, handler)
      },
    },
  }
}

describe('MCP Finish Plan access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auditFindUnique.mockResolvedValue({
      id: 'report-1',
      status: 'COMPLETED',
      url: 'https://example.com',
      userId: null,
      isPublic: true,
      aiReviewAt: null,
      flags: [],
      rubrics: [],
    })
    mocks.loadCompletedTaskOutcome.mockResolvedValue({
      reportId: 'report-1',
      status: 'COMPLETED',
      fixList: { reportId: 'report-1', totalCount: 4, items: [] },
      finishPlan: {
        reportId: 'report-1',
        items: [{ flagId: 'flag-1' }, { flagId: 'flag-2' }, { flagId: 'flag-3' }],
        planPrompt: 'Only flags 1-3',
      },
    })
  })

  it('requests no prompts for a live anonymous report and one only for the curated sample', async () => {
    const live = fakeServer()
    registerAnonCheckStatusTools(live.server as never)
    await live.handlers.get('ff_get_report')?.({ reportId: 'report-1' })
    expect(mocks.loadCompletedTaskOutcome).toHaveBeenLastCalledWith(
      'report-1',
      undefined,
      { promptAccess: 'none' }
    )

    mocks.isPublicMarketingSample.mockReturnValue(true)
    await live.handlers.get('ff_get_report')?.({ reportId: 'report-1' })
    expect(mocks.loadCompletedTaskOutcome).toHaveBeenLastCalledWith(
      'report-1',
      undefined,
      { promptAccess: 'one' }
    )
  })

  it('defaults the current Finish Plan to three and rebuilds it for a smaller limit', async () => {
    const authenticated = fakeServer()
    registerFlagTools(authenticated.server as never, { id: 'user-1' } as never)

    const defaultResult = await authenticated.handlers.get('ff_get_current_finish_plan')?.({
      reportId: 'report-1',
    })
    expect(mocks.loadCompletedTaskOutcome).toHaveBeenLastCalledWith(
      'report-1',
      undefined,
      { finishPlanLimit: 3 }
    )
    expect(JSON.parse(defaultResult?.content[0]?.text ?? '{}')).toMatchObject({
      selectedCount: 3,
      totalCount: 4,
      planPrompt: 'Only flags 1-3',
    })

    await authenticated.handlers.get('ff_get_current_finish_plan')?.({
      reportId: 'report-1',
      limit: 2,
      tool: 'cursor',
    })
    expect(mocks.loadCompletedTaskOutcome).toHaveBeenLastCalledWith(
      'report-1',
      'cursor',
      { finishPlanLimit: 2 }
    )
  })
})
