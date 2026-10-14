import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ runs: vi.fn(), fail: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { runRequest: { findMany: mocks.runs, updateMany: mocks.fail } } }))
import { recoverExpiredSiteRuns } from '../run-leases'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.runs.mockResolvedValueOnce([{ projectId: 'interrupted-site' }, { projectId: 'other-site' }])
    .mockRejectedValueOnce(new Error('Controlled Site recovery read failure'))
    .mockResolvedValueOnce([{ id: 'abandoned-run', auditId: null }])
  mocks.fail.mockResolvedValue({ count: 1 })
})

describe('independent expired Site run recovery', () => {
  it('continues reclaiming another Site after one candidate query fails', async () => {
    expect(await recoverExpiredSiteRuns(async () => {})).toBe(1)
    expect(mocks.runs.mock.calls.slice(1).map(([input]) => input.where.projectId)).toEqual(['interrupted-site', 'other-site'])
    expect(mocks.fail).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'abandoned-run', auditId: null }), data: expect.objectContaining({ status: 'FAILED' }),
    }))
  })
})
