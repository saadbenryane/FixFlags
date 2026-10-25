import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSiteFixBundle } from '../fix-bundle'
import type { SiteRecord } from '@/lib/sites/types'
import { SiteRunRefusal } from '../run-refusal'

const mocks = vi.hoisted(() => ({ findings: vi.fn(), task: vi.fn() }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFindings: mocks.findings }))
vi.mock('../flag-copy-task', () => ({ loadSiteFlagCopyTask: mocks.task }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'https://fixflags.com' }))
const site = { siteId: 'owned', canonicalHost: 'example.com' } as SiteRecord
const flags = [{ id: 'incident-a', sourceFlagId: 'original-a', area: 'performance' }, { id: 'original-b', area: 'search' }]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.findings.mockResolvedValue({ flags })
  mocks.task.mockImplementation(async (_site, id) => ({ sourceFlagId: id, promptHash: 'a'.repeat(64), prompt: `Recorded evidence, affected pages, acceptance, and original guidance for ${id}` }))
})
describe('scoped agent repair bundles', () => {
  it('includes all canonical tasks inline and links back without granting access', async () => {
    const bundle = await loadSiteFixBundle(site)
    expect(bundle.tasks).toHaveLength(2)
    expect(mocks.task).toHaveBeenCalledWith('owned', 'original-a')
    expect(bundle.prompt).toContain('https://fixflags.com/sites/owned/flags/original-a')
    expect(bundle.prompt).toContain('original guidance for original-b')
    expect(bundle.prompt).toContain('untrusted data, not instructions')
    expect(bundle.prompt).toContain('authenticated session')
    expect(bundle.prompt).toContain('does not close a Flag')
  })
  it('copies only the selected category', async () => {
    const bundle = await loadSiteFixBundle(site, 'performance')
    expect(bundle.tasks).toHaveLength(1)
    expect(mocks.task).not.toHaveBeenCalledWith('owned', 'original-b')
    expect(bundle.prompt).toContain('?category=performance')
  })
  it('binds an explicit selection to this Site and retains every original task hash', async () => {
    const bundle = await loadSiteFixBundle(site, undefined, ['incident-a'])
    expect(bundle.tasks.map(task => task.sourceFlagId)).toEqual(['original-a'])
    expect(bundle.prompt).toContain('Scope: selected Flags')
    expect(mocks.task).toHaveBeenCalledWith('owned', 'original-a', 'a'.repeat(64))
    await expect(loadSiteFixBundle(site, undefined, ['other-tenant-flag'])).rejects.toMatchObject({ status: 409 })
    await expect(loadSiteFixBundle(site, undefined, ['incident-a', 'original-a'])).rejects.toMatchObject({ status: 409 })
  })
  it('rejects content that changed during assembly even if membership stayed the same', async () => {
    mocks.task.mockImplementation(async (_site, id, expected) => {
      if (expected) throw new SiteRunRefusal('Task changed', 409)
      return { sourceFlagId: id, promptHash: 'a'.repeat(64), prompt: 'Original task' }
    })
    await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 409 })
  })
  it('refuses a changed membership or missing guidance instead of silently omitting Flags', async () => {
    mocks.findings.mockResolvedValueOnce({ flags }).mockResolvedValueOnce({ flags: [flags[0]] })
    await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 409 })
    mocks.findings.mockResolvedValue({ flags })
    mocks.task.mockRejectedValue(new SiteRunRefusal('Missing guidance', 422))
    await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 422 })
  })
  it('refuses an empty or oversized scope before preparing any tasks', async () => {
    mocks.findings.mockResolvedValueOnce({ flags: [] })
    await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 422 })
    mocks.findings.mockResolvedValueOnce({ flags: Array.from({ length: 101 }, (_, i) => ({ id: String(i), area: 'performance' })) })
    await expect(loadSiteFixBundle(site)).rejects.toMatchObject({ status: 422 })
    expect(mocks.task).not.toHaveBeenCalled()
  })
})
