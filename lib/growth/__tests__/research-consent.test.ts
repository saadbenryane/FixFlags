import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db } = vi.hoisted(() => ({ db: { project: vi.fn(), lock: vi.fn(), latest: vi.fn(), create: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: {
  project: { findFirst: db.project }, siteLifecycleEvent: { findFirst: db.latest },
  $transaction: (run: (tx: unknown) => unknown) => run({ $queryRaw: db.lock, siteLifecycleEvent: { findFirst: db.latest, create: db.create } }),
} }))
import { loadResearchConsent, saveResearchConsent, researchSiteIdentity, researchAuditMatchesSite } from '../research-consent'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
const owner = { projectId: 'project', userId: 'owner' }
const account = { lifecycleStatus: 'ACTIVE', lifecycleRevision: 0 }
const project = { id: 'project', userId: 'owner', url: 'https://synthetic.example/', watchTargetRevision: 1, user: account, ...account }
const grant = { id: 'grant', version: 1, userId: 'owner', createdAt: new Date('2026-10-13T10:00:00Z'),
  properties: { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity: researchSiteIdentity(project.url) } }

describe('Site research permission', () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.project.mockResolvedValue(project); db.lock.mockResolvedValue([project]); db.latest.mockResolvedValue(null)
    db.create.mockImplementation(async ({ data }) => ({ id: 'new-grant', ...data }))
  })
  it('defaults to off and checks the current owner and deletion state', async () => {
    expect(await loadResearchConsent(owner)).toEqual({ enabled: false, grantedAt: null, policyVersion: RESEARCH_CONSENT_VERSION })
    expect(db.project).toHaveBeenCalledWith({ where: { id: 'project', userId: 'owner', deletedAt: null },
      select: { id: true, userId: true, url: true, watchTargetRevision: true,
        user: { select: { lifecycleStatus: true, lifecycleRevision: true } } } })
    db.project.mockResolvedValue(null)
    await expect(loadResearchConsent(owner)).rejects.toMatchObject({ status: 404 })
  })
  it('requires an explicit current policy, keeps an append-only grant, and is idempotent', async () => {
    await expect(saveResearchConsent(owner, { enabled: true })).rejects.toThrow()
    await expect(saveResearchConsent(owner, { enabled: true, policyVersion: 'old-policy' })).rejects.toThrow()
    const view = await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
    expect(view.enabled).toBe(true)
    expect(db.create.mock.calls[0][0].data).toMatchObject({ projectId: 'project', userId: 'owner', version: 1,
      properties: { ...grant.properties, ownerLifecycleRevision: 0, siteTargetRevision: 1 } })
    db.latest.mockResolvedValue(grant)
    await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
    expect(db.create).toHaveBeenCalledTimes(1)
  })
  it('allows withdrawal without agreeing to a new policy and orders it after the grant', async () => {
    db.latest.mockResolvedValue(grant)
    expect((await saveResearchConsent(owner, { enabled: false })).enabled).toBe(false)
    expect(db.create.mock.calls[0][0].data.createdAt.getTime()).toBeGreaterThan(grant.createdAt.getTime())
    expect(db.create.mock.calls[0][0].data.properties.enabled).toBe(false)
  })
  it('does not carry permission across owners, changed domains, or unknown versions', async () => {
    for (const previous of [{ ...grant, userId: 'other' }, { ...grant, version: 2 }, { ...grant, properties: { ...grant.properties, siteIdentity: researchSiteIdentity('https://other.example') } }]) {
      db.latest.mockResolvedValue(previous)
      expect((await loadResearchConsent(owner)).enabled).toBe(false)
    }
  })
  it('refuses writes to a deleted or foreign Site before creating any record', async () => {
    db.lock.mockResolvedValueOnce([{ id: owner.userId }]).mockResolvedValueOnce([])
    await expect(saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).rejects.toMatchObject({ status: 404 })
    expect(db.create).not.toHaveBeenCalled()
  })

  it('persists withdrawal even when a domain change already made the old grant ineligible', async () => {
    db.latest.mockResolvedValue({ ...grant, properties: { ...grant.properties, siteIdentity: researchSiteIdentity('https://old-domain.example') } })
    await saveResearchConsent(owner, { enabled: false })
    expect(db.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      properties: { ...grant.properties, enabled: false, ownerLifecycleRevision: 0, siteTargetRevision: 1 },
    }) }))
  })

  it('withholds stale grants after reactivation and allows a fresh active-owner grant', async () => {
    db.latest.mockResolvedValue(grant)
    const reactivated = { lifecycleStatus: 'ACTIVE', lifecycleRevision: 2 }
    db.project.mockResolvedValue({ ...project, user: reactivated })
    expect((await loadResearchConsent(owner)).enabled).toBe(false)
    db.lock.mockResolvedValueOnce([{ id: owner.userId }]).mockResolvedValueOnce([{ ...project, ...reactivated }])
    expect((await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).enabled).toBe(true)
    expect(db.create.mock.calls[0][0].data.properties).toMatchObject({ ownerLifecycleRevision: 2, enabled: true })
  })

  it('rejects an unavailable account before granting and still records withdrawal', async () => {
    const suspended = { lifecycleStatus: 'SUSPENDED', lifecycleRevision: 1 }
    db.latest.mockResolvedValue(grant)
    db.project.mockResolvedValue({ ...project, user: suspended })
    expect((await loadResearchConsent(owner)).enabled).toBe(false)
    db.lock.mockResolvedValueOnce([])
    await expect(saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION }))
      .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    expect(db.create).not.toHaveBeenCalled()
    db.lock.mockResolvedValueOnce([{ ...project, ...suspended }])
    expect((await saveResearchConsent(owner, { enabled: false })).enabled).toBe(false)
    expect(db.create.mock.calls[0][0].data.properties).toMatchObject({ ownerLifecycleRevision: 1, enabled: false })
  })

  it('requires a new grant after a Site target revision changes even if the address is restored', async () => {
    const restored = { ...project, watchTargetRevision: 3 }
    db.project.mockResolvedValue(restored)
    for (const previous of [grant, { ...grant, properties: { ...grant.properties, siteTargetRevision: 1 } }]) {
      db.latest.mockResolvedValue(previous)
      expect((await loadResearchConsent(owner)).enabled).toBe(false)
    }
    db.lock.mockResolvedValueOnce([{ id: owner.userId }]).mockResolvedValueOnce([restored])
    expect((await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).enabled).toBe(true)
    expect(db.create.mock.calls[0][0].data.properties).toMatchObject({ siteTargetRevision: 3, enabled: true })
  })

  it('binds consent to the Site address without retaining query secrets and allows only its page scope', () => {
    expect(researchSiteIdentity('https://site.example/store?secret=one')).toBe(researchSiteIdentity('https://site.example/store/?secret=two'))
    expect(researchAuditMatchesSite('https://site.example/store', 'https://site.example/store/pricing')).toBe(true)
    expect(researchAuditMatchesSite('https://site.example/store', 'https://site.example/elsewhere')).toBe(false)
    expect(researchAuditMatchesSite('https://site.example/', 'https://site.example:8443/')).toBe(false)
    expect(researchAuditMatchesSite('https://site.example/store', 'https://site.example/store/caf%C3%A9%20menu')).toBe(true)
  })

  it.each([
    '/store/..%2Felsewhere',
    '/store/%2e%2e%5celsewhere',
    '/store/%252e%252e%252felsewhere',
    '/store/..;part/elsewhere',
    '/store/..%3Bpart/elsewhere',
    '/store/path%3Ftoken=value',
    '/store/path%23token',
    '/store//nested',
    '/store/path%00suffix',
    '/store/path%zz',
    '/store/path%C0%AFsuffix',
  ])('withholds ambiguous research path %s', (path) => {
    const url = 'https://site.example' + path
    expect(researchAuditMatchesSite('https://site.example/store', url)).toBe(false)
    expect(researchAuditMatchesSite(url, url)).toBe(false)
  })
})
