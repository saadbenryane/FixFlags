import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db } = vi.hoisted(() => ({ db: { project: vi.fn(), lock: vi.fn(), latest: vi.fn(), create: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: {
  project: { findFirst: db.project }, siteLifecycleEvent: { findFirst: db.latest },
  $transaction: (run: (tx: unknown) => unknown) => run({ $queryRaw: db.lock, siteLifecycleEvent: { findFirst: db.latest, create: db.create } }),
} }))
import { loadResearchConsent, saveResearchConsent, researchSiteIdentity, researchAuditMatchesSite } from '../research-consent'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
const owner = { projectId: 'project', userId: 'owner' }
const project = { id: 'project', url: 'https://synthetic.example/' }
const grant = { id: 'grant', version: 1, userId: 'owner', createdAt: new Date('2026-10-13T10:00:00Z'),
  properties: { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity: researchSiteIdentity(project.url) } }

describe('Site research permission', () => {
  beforeEach(() => {
    vi.clearAllMocks(); db.project.mockResolvedValue(project); db.lock.mockResolvedValue([project]); db.latest.mockResolvedValue(null)
    db.create.mockImplementation(async ({ data }) => ({ id: 'new-grant', ...data }))
  })
  it('defaults to off and checks the current owner and deletion state', async () => {
    expect(await loadResearchConsent(owner)).toEqual({ enabled: false, grantedAt: null, policyVersion: RESEARCH_CONSENT_VERSION })
    expect(db.project).toHaveBeenCalledWith({ where: { id: 'project', userId: 'owner', deletedAt: null }, select: { id: true, url: true } })
    db.project.mockResolvedValue(null)
    await expect(loadResearchConsent(owner)).rejects.toMatchObject({ status: 404 })
  })
  it('requires an explicit current policy, keeps an append-only grant, and is idempotent', async () => {
    await expect(saveResearchConsent(owner, { enabled: true })).rejects.toThrow()
    await expect(saveResearchConsent(owner, { enabled: true, policyVersion: 'old-policy' })).rejects.toThrow()
    const view = await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
    expect(view.enabled).toBe(true)
    expect(db.create.mock.calls[0][0].data).toMatchObject({ projectId: 'project', userId: 'owner', version: 1, properties: grant.properties })
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
    db.lock.mockResolvedValue([])
    await expect(saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).rejects.toMatchObject({ status: 404 })
    expect(db.create).not.toHaveBeenCalled()
  })

  it('persists withdrawal even when a domain change already made the old grant ineligible', async () => {
    db.latest.mockResolvedValue({ ...grant, properties: { ...grant.properties, siteIdentity: researchSiteIdentity('https://old-domain.example') } })
    await saveResearchConsent(owner, { enabled: false })
    expect(db.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ properties: { ...grant.properties, enabled: false } }) }))
  })

  it('binds consent to the Site address without retaining query secrets and allows only its page scope', () => {
    expect(researchSiteIdentity('https://site.example/store?secret=one')).toBe(researchSiteIdentity('https://site.example/store/?secret=two'))
    expect(researchAuditMatchesSite('https://site.example/store', 'https://site.example/store/pricing')).toBe(true)
    expect(researchAuditMatchesSite('https://site.example/store', 'https://site.example/elsewhere')).toBe(false)
    expect(researchAuditMatchesSite('https://site.example/', 'https://site.example:8443/')).toBe(false)
  })
})
