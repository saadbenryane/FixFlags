import { beforeEach, expect, it, vi } from 'vitest'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

const mocks = vi.hoisted(() => ({ site: vi.fn(), flag: vi.fn(), owner: vi.fn(), finding: vi.fn(), performance: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: mocks.owner }, journeyFinding: { findFirst: mocks.finding } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.flag, loadSiteFindings: vi.fn(), loadSiteResolvedFlags: vi.fn() }))
vi.mock('../performance-evidence', () => ({ loadPerformanceEvidence: mocks.performance }))
import { loadSiteBoardFlag } from '../queries'

const site = siteViewFixture().site
beforeEach(() => {
  vi.resetAllMocks()
  mocks.owner.mockResolvedValue({ id: site.projectId })
  mocks.site.mockResolvedValue(site)
  mocks.flag.mockResolvedValue({ id: 'flag', sourceFlagId: 'source', sourceAuditId: 'audit', checkId: null })
  mocks.finding.mockResolvedValue(null)
})

it('keeps the admitted Site without resolving another owner while loading the composed evidence', async () => {
  const result = await loadSiteBoardFlag(site.siteId, 'flag', site)
  expect(result?.site).toBe(site)
  expect(mocks.site).not.toHaveBeenCalled()
  expect(mocks.flag).toHaveBeenCalledWith(site, 'flag')
  expect(mocks.owner).toHaveBeenCalledTimes(2)
})

it('withholds the composed Flag when authority changes after its source read and before capture lookup settles', async () => {
  let finish!: (value: unknown) => void
  let allowed = true
  mocks.owner.mockImplementation(async () => allowed ? { id: site.projectId } : null)
  mocks.finding.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const read = loadSiteBoardFlag(site.siteId, 'flag', site)
  const denied = expect(read).rejects.toMatchObject({ status: 404 })
  await vi.waitFor(() => expect(mocks.finding).toHaveBeenCalledOnce())
  allowed = false
  finish({ screenshotUrl: '/api/screenshots/private/audit.png', createdAt: new Date() })
  await denied
  expect(mocks.owner).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
    id: site.projectId, userId: site.userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' },
  }) }))
})

it('retains the original capture on a successful authorized read', async () => {
  const date = new Date('2026-11-03T12:00:00Z')
  mocks.finding.mockResolvedValue({ screenshotUrl: '/api/screenshots/source-audit/capture.png?device=mobile', createdAt: date })
  const result = await loadSiteBoardFlag(site.siteId, 'flag', site)
  expect(result?.capture).toEqual({ url: '/api/screenshots/source-audit/capture.png?device=mobile', recordedAt: date.toISOString() })
})
