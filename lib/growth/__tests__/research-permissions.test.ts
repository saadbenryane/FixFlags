import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db } = vi.hoisted(() => ({ db: { artifact: vi.fn(), projects: vi.fn(), grants: vi.fn(), audits: vi.fn(), flags: vi.fn(), technologies: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: { growthArtifact: { findUnique: db.artifact }, project: { findMany: db.projects },
  siteLifecycleEvent: { findMany: db.grants }, audit: { findMany: db.audits }, flag: { findMany: db.flags }, auditTechnologyObservation: { findMany: db.technologies } } }))
import { hasCurrentResearchPermissions, RESEARCH_PERMISSIONS_KIND } from '../research-permissions'
import { researchSiteIdentity } from '../research-consent'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
import { researchFixture } from '@/lib/graph/__tests__/fixtures/public-research'

function fixture() {
  const dataset = researchFixture(); dataset.sampleSiteCount = 20; dataset.issues[0].siteCount = 20
  dataset.issues[0].occurrenceCount = 20; dataset.issues[0].topFrameworks = []
  const projects = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, userId: `u${i}`, url: `https://site${i}.example/` }))
  const grants = projects.map((p, i) => ({ id: `g${i}`, version: 1, projectId: p.id, userId: p.userId,
    properties: { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity: researchSiteIdentity(p.url) }, createdAt: new Date('2026-09-01T00:00:00Z') }))
  const audits = projects.map((p, i) => ({ id: `a${i}`, projectId: p.id, userId: p.userId, url: p.url,
    status: 'COMPLETED', createdAt: new Date('2026-09-05T00:00:00Z'), completedAt: new Date('2026-09-05T01:00:00Z') }))
  const manifest = { version: 1, evidenceRef: dataset.evidenceRef, sources: projects.map((p, i) => ({ projectId: p.id, grantId: grants[i].id, auditId: audits[i].id })) }
  const flags = audits.map((audit, i) => ({ id: `f${i}`, auditId: audit.id, checkId: 'security-headers-missing', source: 'DETERMINISTIC', confidence: 0.95, createdAt: new Date('2026-09-05T00:30:00Z') }))
  return { dataset, projects, grants, audits, manifest, flags }
}
describe('current permissions for public research', () => {
  beforeEach(() => { vi.clearAllMocks(); db.technologies.mockResolvedValue([]) })
  async function check(f: ReturnType<typeof fixture>) {
    db.artifact.mockResolvedValue({ kind: RESEARCH_PERMISSIONS_KIND, payload: f.manifest })
    db.projects.mockResolvedValue(f.projects); db.grants.mockResolvedValue(f.grants); db.audits.mockResolvedValue(f.audits)
    db.flags.mockResolvedValue(f.flags)
    return hasCurrentResearchPermissions(f.dataset)
  }
  it('accepts a complete reviewed cohort with current, matching, prospective grants', async () => { expect(await check(fixture())).toBe(true) })
  it.each([
    ['withdrawal', (f: ReturnType<typeof fixture>) => { f.grants[0].properties.enabled = false }],
    ['new grant after withdrawal', (f: ReturnType<typeof fixture>) => { f.grants[0].id = 'regranted' }],
    ['deletion', (f: ReturnType<typeof fixture>) => { f.projects.shift() }],
    ['changed owner', (f: ReturnType<typeof fixture>) => { f.projects[0].userId = 'new-owner' }],
    ['changed domain', (f: ReturnType<typeof fixture>) => { f.projects[0].url = 'https://different.example' }],
    ['changed Site path', (f: ReturnType<typeof fixture>) => { f.projects[0].url += 'other-app' }],
    ['different port', (f: ReturnType<typeof fixture>) => { f.audits[0].url = 'https://site0.example:8443/' }],
    ['pre-consent data', (f: ReturnType<typeof fixture>) => { f.audits[0].createdAt = new Date('2026-08-31T00:00:00Z') }],
    ['foreign audit', (f: ReturnType<typeof fixture>) => { f.audits[0].projectId = 'foreign' }],
    ['foreign owner', (f: ReturnType<typeof fixture>) => { f.audits[0].userId = 'foreign' }],
    ['off-site evidence', (f: ReturnType<typeof fixture>) => { f.audits[0].url = 'https://foreign.example' }],
    ['incomplete check', (f: ReturnType<typeof fixture>) => { f.audits[0].status = 'FAILED' }],
    ['out-of-window evidence', (f: ReturnType<typeof fixture>) => { f.audits[0].completedAt = new Date('2026-10-01T00:00:00Z') }],
    ['inconsistent timestamps', (f: ReturnType<typeof fixture>) => { f.audits[0].completedAt = new Date('2026-09-04T00:00:00Z') }],
    ['missing sources', (f: ReturnType<typeof fixture>) => { f.audits.pop() }],
    ['mismatched release', (f: ReturnType<typeof fixture>) => { f.manifest.evidenceRef = 'different' }],
    ['inflated site diversity', (f: ReturnType<typeof fixture>) => { f.dataset.sampleSiteCount = 21 }],
    ['duplicate source', (f: ReturnType<typeof fixture>) => { f.manifest.sources.push(f.manifest.sources[0]) }],
    ['inflated observations', (f: ReturnType<typeof fixture>) => { f.dataset.issues[0].occurrenceCount = 40 }],
    ['inflated affected sites', (f: ReturnType<typeof fixture>) => { f.dataset.issues[0].siteCount = 21 }],
    ['AI-only interpretation', (f: ReturnType<typeof fixture>) => { f.flags[0].source = 'AI' }],
    ['weak confidence', (f: ReturnType<typeof fixture>) => { f.flags[0].confidence = 0.5 }],
    ['nonfinite confidence', (f: ReturnType<typeof fixture>) => { f.flags[0].confidence = Number.NaN }],
    ['finding added after review', (f: ReturnType<typeof fixture>) => { f.flags[0].createdAt = new Date('2026-10-02T00:00:00Z') }],
    ['unproven framework cell', (f: ReturnType<typeof fixture>) => { f.dataset.issues[0].topFrameworks = [{ name: 'Next.js', siteCount: 20 }] }],
  ])('withholds a release after %s', async (_name, mutate) => {
    const f = fixture(); mutate(f); expect(await check(f)).toBe(false)
  })
  it('does not authorize a release without its private source manifest', async () => {
    db.artifact.mockResolvedValue(null)
    expect(await hasCurrentResearchPermissions(fixture().dataset)).toBe(false)
    expect(db.audits).not.toHaveBeenCalled()
  })

  it('counts page variants by base identity and repeated rows only once', async () => {
    const f = fixture(); f.flags[0].checkId += '::page:1'; f.flags.push(f.flags[0])
    expect(await check(f)).toBe(true)
  })

  it('uses technology observations from affected source audits rather than a current hostname snapshot', async () => {
    const f = fixture(); f.dataset.issues[0].topFrameworks = [{ name: 'Next.js', siteCount: 20 }]
    const observations = f.audits.map((audit) => ({ auditId: audit.id, confidence: 0.95, detectorVersion: 'capture-v1',
      detectedAt: new Date('2026-09-05T00:30:00Z'), technology: { name: 'Next.js', kind: 'framework' } }))
    db.technologies.mockResolvedValue(observations)
    expect(await check(f)).toBe(true)
    observations[0].detectedAt = new Date('2026-10-02T00:00:00Z')
    expect(await check(f)).toBe(false)
  })
})
