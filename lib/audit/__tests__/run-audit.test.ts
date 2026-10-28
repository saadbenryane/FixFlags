import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db } = vi.hoisted(() => {
  const db = {
    audit: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
    $queryRaw: vi.fn(),
    runRequest: { findMany: vi.fn() },
    $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work(db)),
  }
  return { db }
})
const handlers = vi.hoisted(() => ({ coordinate: vi.fn(), deliver: vi.fn(), project: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: db }))
vi.mock('@/lib/audit/progressive/runtime', () => ({ coordinateProgressiveAudit: handlers.coordinate }))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ enqueuePendingAiReview: handlers.deliver }))
vi.mock('@/lib/audit/finalize', () => ({ persistImprovementCycle: handlers.project }))
import { runAudit } from '../runner'

const spec = { version: 1, engine: 'progressive-v1', targetUrl: 'https://example.com/', environment: 'production',
  scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null }
beforeEach(() => {
  vi.clearAllMocks()
  db.audit.findUnique.mockResolvedValue({ id: 'audit', status: 'QUEUED', executionSpec: spec })
  db.audit.findUniqueOrThrow.mockResolvedValue({ executionGeneration: 1 })
  db.audit.updateMany.mockResolvedValue({ count: 1 })
  db.$queryRaw.mockResolvedValue([{ id: 'audit', authorized: true }])
  db.runRequest.findMany.mockResolvedValue([])
})

describe('single audit execution engine', () => {
  it('delegates new checks to the progressive coordinator without running a second pipeline', async () => {
    await runAudit('audit')
    expect(handlers.coordinate).toHaveBeenCalledWith('audit')
    expect(db.audit.updateMany).not.toHaveBeenCalled()
  })
  it('keeps failed checks terminal', async () => {
    db.audit.findUnique.mockResolvedValue({ status: 'FAILED' })
    await runAudit('audit')
    expect(handlers.coordinate).not.toHaveBeenCalled()
    expect(db.audit.updateMany).not.toHaveBeenCalled()
  })
  it('resumes interrupted completed projections and pending prescription delivery', async () => {
    db.audit.findUnique.mockResolvedValue({ status: 'COMPLETED', parentId: 'parent' })
    await runAudit('audit')
    expect(handlers.deliver).toHaveBeenCalledWith('audit')
    expect(handlers.project).toHaveBeenCalledWith('audit', 'parent')
    expect(handlers.coordinate).not.toHaveBeenCalled()
  })
  it('does not borrow another completion projection lease', async () => {
    db.audit.findUnique.mockResolvedValue({ status: 'COMPLETED' })
    db.audit.updateMany.mockResolvedValue({ count: 0 })
    await runAudit('audit')
    expect(handlers.deliver).toHaveBeenCalledWith('audit')
    expect(handlers.project).not.toHaveBeenCalled()
  })
  it.each([null, { version: 999 }, { ...spec, engine: undefined }])('retires an unfinished legacy admission without replaying work: %j', async executionSpec => {
    db.audit.findUnique.mockResolvedValue({ status: 'CAPTURING', executionSpec })
    await runAudit('audit')
    expect(handlers.coordinate).not.toHaveBeenCalled()
    expect(db.audit.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'FAILED', failureCode: 'LEGACY_EXECUTION_RETIRED' }),
    }))
  })
  it('does not retire a legacy delivery while another worker owns its lease', async () => {
    db.audit.findUnique.mockResolvedValue({ status: 'CAPTURING', executionSpec: null })
    db.audit.updateMany.mockResolvedValue({ count: 0 })
    await runAudit('audit')
    expect(db.runRequest.findMany).not.toHaveBeenCalled()
  })
  it('rejects a missing audit', async () => {
    db.audit.findUnique.mockResolvedValue(null)
    await expect(runAudit('missing')).rejects.toThrow('not found')
  })
})
