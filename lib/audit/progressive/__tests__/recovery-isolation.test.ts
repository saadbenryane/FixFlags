import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ pending: vi.fn(), read: vi.fn(), recover: vi.fn(), rotate: vi.fn(),
  execute: vi.fn(), continueGraph: vi.fn(), closeParser: vi.fn(), error: vi.fn(),
  processors: [] as Array<(job: { data: { auditId: string } }) => Promise<unknown>>,
  closes: [] as ReturnType<typeof vi.fn>[],
}))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUniqueOrThrow: mocks.read } } }))
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }))
vi.mock('@/lib/queue/bullmq-ownership', () => ({ createOwnedWorker: (_name: string, process: typeof mocks.processors[number]) => {
  const close = vi.fn(async () => {}); mocks.closes.push(close); mocks.processors.push(process)
  return { close, waitUntilReady: async () => {}, on: vi.fn() }
} }))
vi.mock('../recovery-claim', () => ({ selectProgressiveRecovery: mocks.pending, claimProgressiveRecovery: mocks.rotate }))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ recoverPendingAiReviews: async () => 0 }))
vi.mock('../engine', () => ({ recoverProgressiveTasks: mocks.recover, executeTask: mocks.execute, continueTaskGraph: mocks.continueGraph }))
vi.mock('../cpu', () => ({ closeParserWorker: mocks.closeParser }))
vi.mock('../collectors', () => ({ collectionHandlers: [] }))
vi.mock('../evaluators', () => ({ evaluatorHandlers: [] }))
vi.mock('../lifecycle', () => ({ lifecycleHandlers: [] }))
vi.mock('../accounts', () => ({ accountHandlers: [] }))
vi.mock('../actions', () => ({ actionHandlers: [] }))
vi.mock('@/lib/audit/advertised-coverage', () => ({ ADVERTISED_COVERAGE_REGISTRY: new Map() }))
import { recoverProgressiveAudits, startProgressiveWorkers } from '../runtime'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.processors.length = 0; mocks.closes.length = 0
  mocks.continueGraph.mockResolvedValue(undefined)
  mocks.execute.mockImplementation(async (job, _handlers, continuation) => { continuation(job.auditId) })
  mocks.pending.mockResolvedValue([{ id: 'failed-admission' }, { id: 'other-admission' }])
  mocks.rotate.mockResolvedValue(1)
  mocks.read.mockRejectedValueOnce(new Error('Controlled admission read failure'))
    .mockResolvedValue({ id: 'other-admission', executionSpec: null })
  mocks.recover.mockResolvedValue(3)
})

describe('owned post-commit task coordination', () => {
  it('releases physical work and drains admitted continuation before parser teardown', async () => {
    const publication = Promise.withResolvers<void>()
    mocks.continueGraph.mockReturnValueOnce(publication.promise)
    const workers = startProgressiveWorkers()
    await workers.waitUntilReady()
    await mocks.processors[0]({ data: { auditId: 'committed-observation' } })
    expect(workers.activeCount()).toBe(0)
    let closed = false
    const closing = workers.close()
    expect(workers.close()).toBe(closing)
    void closing.then(() => { closed = true })
    try {
      await Promise.all(mocks.closes.map(close => close.mock.results[0].value))
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(closed).toBe(false)
      expect(mocks.closeParser).not.toHaveBeenCalled()
    } finally { publication.resolve(); await closing }
    expect(closed).toBe(true)
    expect(mocks.closeParser).toHaveBeenCalledOnce()
    for (const close of mocks.closes) expect(close).toHaveBeenCalledOnce()
  })

  it('records a continuation failure without withholding later task capacity or shutdown', async () => {
    const failure = new Error('Controlled publication failure')
    mocks.continueGraph.mockRejectedValueOnce(failure)
    const workers = startProgressiveWorkers()
    await mocks.processors[0]({ data: { auditId: 'interrupted-publication' } })
    await mocks.processors[0]({ data: { auditId: 'independent-observation' } })
    await workers.close()
    expect(workers.activeCount()).toBe(0)
    expect(mocks.continueGraph.mock.calls).toEqual([['interrupted-publication'], ['independent-observation']])
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('durable work remains recoverable'), failure,
      { auditId: 'interrupted-publication' })
    expect(mocks.closeParser).toHaveBeenCalledOnce()
  })
})

describe('independent progressive recovery phases', () => {
  it('continues other pending admissions and existing graph recovery after one admission fails', async () => {
    expect(await recoverProgressiveAudits(5)).toBe(3)
    expect(mocks.read.mock.calls).toEqual(['failed-admission', 'other-admission'].map(id => [{
      where: { id }, select: { status: true, executionSpec: true },
    }]))
    expect(mocks.recover).toHaveBeenCalledWith(5)
    expect(mocks.rotate.mock.calls).toEqual(['failed-admission', 'other-admission'].map(id => ['coordinator', expect.any(Date), id]))
  })
  it('does not coordinate a stale admission after another sweep advances its due time', async () => {
    mocks.rotate.mockResolvedValue(0)
    expect(await recoverProgressiveAudits()).toBe(3)
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.recover).toHaveBeenCalledOnce()
  })
  it('recovers existing graphs when the pending admission query fails', async () => {
    mocks.pending.mockRejectedValue(new Error('Controlled admission query failure'))
    expect(await recoverProgressiveAudits()).toBe(3)
    expect(mocks.rotate).not.toHaveBeenCalled()
    expect(mocks.recover).toHaveBeenCalledOnce()
  })
})
