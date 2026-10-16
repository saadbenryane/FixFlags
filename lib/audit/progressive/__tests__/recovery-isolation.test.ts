import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ pending: vi.fn(), read: vi.fn(), recover: vi.fn(), rotate: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findMany: mocks.pending, findUniqueOrThrow: mocks.read, updateMany: mocks.rotate } } }))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ recoverPendingAiReviews: async () => 0 }))
vi.mock('../engine', () => ({ recoverProgressiveTasks: mocks.recover }))
vi.mock('../collectors', () => ({ collectionHandlers: [] }))
vi.mock('../evaluators', () => ({ evaluatorHandlers: [] }))
vi.mock('../lifecycle', () => ({ lifecycleHandlers: [] }))
vi.mock('../accounts', () => ({ accountHandlers: [] }))
vi.mock('../actions', () => ({ actionHandlers: [] }))
vi.mock('@/lib/audit/advertised-coverage', () => ({ ADVERTISED_COVERAGE_REGISTRY: new Map() }))
import { recoverProgressiveAudits } from '../runtime'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pending.mockResolvedValue([{ id: 'failed-admission', dispatchNextAt: new Date(0) }, { id: 'other-admission', dispatchNextAt: new Date(1) }])
  mocks.rotate.mockResolvedValue({ count: 1 })
  mocks.read.mockRejectedValueOnce(new Error('Controlled admission read failure'))
    .mockResolvedValue({ id: 'other-admission', executionSpec: null })
  mocks.recover.mockResolvedValue(3)
})

describe('independent progressive recovery phases', () => {
  it('continues other pending admissions and existing graph recovery after one admission fails', async () => {
    expect(await recoverProgressiveAudits(5)).toBe(3)
    expect(mocks.read.mock.calls).toEqual([[{ where: { id: 'failed-admission' } }], [{ where: { id: 'other-admission' } }]])
    expect(mocks.recover).toHaveBeenCalledWith(5)
    expect(mocks.rotate.mock.calls.map(([input]) => input.where)).toEqual([
      expect.objectContaining({ id: 'failed-admission', dispatchNextAt: new Date(0) }),
      expect.objectContaining({ id: 'other-admission', dispatchNextAt: new Date(1) }),
    ])
  })
  it('does not coordinate a stale admission after another sweep advances its due time', async () => {
    mocks.rotate.mockResolvedValue({ count: 0 })
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
