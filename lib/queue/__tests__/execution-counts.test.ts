import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  main: { getActiveCount: vi.fn(), getWaitingCount: vi.fn(), getDelayedCount: vi.fn() },
  tasks: vi.fn(),
}))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => mocks.main, getAuditTaskQueue: mocks.tasks }))
vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: vi.fn() }))
const { getWorkerExecutionCounts } = await import('../estimate')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.main.getActiveCount.mockResolvedValue(0)
  mocks.main.getWaitingCount.mockResolvedValue(1)
  mocks.main.getDelayedCount.mockResolvedValue(0)
  mocks.tasks.mockImplementation(resource => ({
    getActiveCount: async () => resource === 'browser' ? 2 : resource === 'provider' ? 1 : 0,
    getWaitingCount: async () => resource === 'evaluate' ? 4 : 0,
    getDelayedCount: async () => resource === 'http' ? 3 : 0,
  }))
})

it('counts active progressive work when the bootstrap queue is idle', async () => {
  expect(await getWorkerExecutionCounts()).toEqual({ activeJobs: 3, waitingJobs: 5, delayedJobs: 3 })
  expect(mocks.tasks.mock.calls.map(([resource]) => resource)).toEqual(['http', 'browser', 'provider', 'evaluate', 'availability'])
})

it('does not turn unavailable queue observations into zero work', async () => {
  mocks.main.getActiveCount.mockRejectedValue(new Error('Queue unavailable'))
  await expect(getWorkerExecutionCounts()).rejects.toThrow('Queue unavailable')
})
