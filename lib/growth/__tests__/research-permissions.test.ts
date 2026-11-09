import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = { artifact: vi.fn(), projects: vi.fn(), grants: vi.fn(), audits: vi.fn(), flags: vi.fn(), technologies: vi.fn(), versions: vi.fn() }
const tx = { growthArtifact: { findUnique: db.artifact }, project: { findMany: db.projects },
  siteLifecycleEvent: { findMany: db.grants }, audit: { findMany: db.audits }, flag: { findMany: db.flags },
  auditTechnologyObservation: { findMany: db.technologies }, $queryRaw: db.versions }
import { hasCurrentResearchPermissions, readResearchReleaseEvidence, RESEARCH_PERMISSIONS_KIND, researchReleaseInputSha256, reviewResearchReleaseEvidence } from '../research-permissions'
import { researchSiteIdentity } from '../research-consent'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
import { researchFixture } from '@/lib/graph/__tests__/fixtures/public-research'
import { countResearchGroups, researchIndependenceGroups } from '../research-independence'

function fixture() {
  const dataset = researchFixture(); dataset.sampleSiteCount = 20; dataset.issues[0].siteCount = 20
  dataset.issues[0].occurrenceCount = 20; dataset.issues[0].topFrameworks = []
  const projects = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, userId: `u${i}`, url: `https://site${i}.example/`,
    watchTargetRevision: 1, user: { lifecycleStatus: 'ACTIVE', lifecycleRevision: 0 } }))
  const grants = projects.map((p, i) => ({ id: `g${i}`, version: 1, projectId: p.id, userId: p.userId,
    properties: { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION, siteIdentity: researchSiteIdentity(p.url) }, createdAt: new Date('2026-09-01T00:00:00Z') }))
  const audits = projects.map((p, i) => ({ id: `a${i}`, projectId: p.id, userId: p.userId, url: p.url,
    status: 'COMPLETED', createdAt: new Date('2026-09-05T00:00:00Z'), completedAt: new Date('2026-09-05T01:00:00Z'),
    technologyDetectionStatus: 'PARTIAL', technologyDetectorVersion: 'capture-v1', technologyDetectedAt: new Date('2026-09-05T00:30:00Z'),
    technologyObservationScope: { pageUrl: p.url, finalUrl: p.url, profile: 'desktop-v1', access: 'public' } }))
  const manifest = { version: 1 as const, evidenceRef: dataset.evidenceRef, sources: projects.map((p, i) => ({ projectId: p.id, grantId: grants[i].id, auditId: audits[i].id })) }
  const flags = audits.map((audit, i) => ({ id: `f${i}`, auditId: audit.id, checkId: 'security-headers-missing', source: 'DETERMINISTIC', confidence: 0.95, createdAt: new Date('2026-09-05T00:30:00Z') }))
  const versions = flags.map((flag, index) => ({ flagId: flag.id, auditId: flag.auditId, pages: [audits[index].url], version: '1',
    collectionTimes: [audits[index].completedAt.toISOString()],
    observationSha256: 'a'.repeat(64), receiptDigests: ['b'.repeat(64)] }))
  return { dataset, projects, grants, audits, manifest, flags, versions }
}
describe('current permissions for public research', () => {
  beforeEach(() => { vi.clearAllMocks(); db.technologies.mockResolvedValue([]) })
  async function check(f: ReturnType<typeof fixture>) {
    db.projects.mockResolvedValue(f.projects); db.grants.mockResolvedValue(f.grants); db.audits.mockResolvedValue(f.audits)
    db.flags.mockResolvedValue(f.flags)
    db.versions.mockResolvedValue(f.versions)
    const reviewedInputSha256 = researchReleaseInputSha256(f.dataset, f.manifest)
    const evidence = await readResearchReleaseEvidence(f.dataset, f.manifest, tx)
    const proof = evidence && await reviewResearchReleaseEvidence(f.dataset, evidence, reviewedInputSha256, tx)
    db.artifact.mockResolvedValue({ kind: RESEARCH_PERMISSIONS_KIND,
      payload: { ...f.manifest, reviewedInputSha256, reviewedEvidenceSha256: proof?.evidenceSha256 ?? '0'.repeat(64) } })
    return hasCurrentResearchPermissions(f.dataset, tx)
  }
  it('accepts a complete reviewed cohort with current, matching, prospective grants', async () => { expect(await check(fixture())).toBe(true) })
  it('links the full sample transitively before counting affected audits', () => {
    const sources = new Map([
      ['first', { ownerId: 'owner-a', hostname: 'first.example' }],
      ['last', { ownerId: 'owner-b', hostname: 'last.example' }],
      ['bridge-a', { ownerId: 'owner-a', hostname: 'bridge.example' }],
      ['bridge-b', { ownerId: 'owner-b', hostname: 'bridge.example' }],
      ['separate', { ownerId: 'first.example', hostname: 'separate.example' }],
    ])
    const groups = researchIndependenceGroups(sources)
    expect(countResearchGroups(['first', 'last'], groups)).toBe(1)
    expect(countResearchGroups(sources.keys(), groups)).toBe(2)
  })

  it('applies the independent group floor to the sample, issue, and framework separately', async () => {
    const f = fixture()
    f.projects[1].userId = f.projects[0].userId
    f.grants[1].userId = f.projects[0].userId
    f.audits[1].userId = f.projects[0].userId
    expect(await check(f)).toBe(false)

    const project = { id: 'p20', userId: 'u20', url: 'https://site20.example/', watchTargetRevision: 1,
      user: { lifecycleStatus: 'ACTIVE', lifecycleRevision: 0 } }
    const audit = { ...f.audits[0], id: 'a20', projectId: project.id, userId: project.userId, url: project.url,
      technologyObservationScope: { ...f.audits[0].technologyObservationScope, pageUrl: project.url, finalUrl: project.url } }
    f.projects.push(project)
    f.grants.push({ ...f.grants[0], id: 'g20', projectId: project.id, userId: project.userId,
      properties: { ...f.grants[0].properties, siteIdentity: researchSiteIdentity(project.url) } })
    f.audits.push(audit)
    f.manifest.sources.push({ projectId: project.id, grantId: 'g20', auditId: audit.id })
    f.dataset.sampleSiteCount = 21
    expect(await check(f)).toBe(false)

    f.flags.push({ ...f.flags[0], id: 'f20', auditId: audit.id })
    f.versions.push({ ...f.versions[0], flagId: 'f20', auditId: audit.id, pages: [audit.url] })
    f.dataset.issues[0].siteCount = 21
    f.dataset.issues[0].occurrenceCount = 21
    expect(await check(f)).toBe(true)

    f.dataset.issues[0].topFrameworks = [{ name: 'Next.js', siteCount: 20 }]
    const technologies = f.audits.map(({ id }) => ({ id: `tech-${id}`, auditId: id, technologyId: 'next',
      confidence: .95, detectorVersion: 'capture-v1', detectedAt: new Date('2026-09-05T00:30:00Z'),
      technology: { name: 'Next.js', kind: 'framework' } }))
    db.technologies.mockResolvedValue(technologies.slice(0, 20))
    expect(await check(f)).toBe(false)
    f.dataset.issues[0].topFrameworks[0].siteCount = 21
    db.technologies.mockResolvedValue(technologies)
    expect(await check(f)).toBe(true)
  })
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
    ['query-bearing target', (f: ReturnType<typeof fixture>) => { f.audits[0].url += '?preview=synthetic' }],
    ['fragment-bearing target', (f: ReturnType<typeof fixture>) => { f.audits[0].url += '#synthetic' }],
    ['ambiguous audit target', (f: ReturnType<typeof fixture>) => { f.audits[0].url += 'store/..%2felsewhere' }],
    ['ambiguous finding page', (f: ReturnType<typeof fixture>) => { f.versions[0].pages = ['https://site0.example/store/..%2felsewhere'] }],
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
    ['missing evaluator receipt', (f: ReturnType<typeof fixture>) => { f.versions.pop() }],
    ['wrong evaluator version', (f: ReturnType<typeof fixture>) => { f.versions[0].version = '2' }],
    ['off-site supporting page', (f: ReturnType<typeof fixture>) => { f.versions[0].pages.push('https://outside.example/') }],
    ['signed supporting page', (f: ReturnType<typeof fixture>) => { f.versions[0].pages[0] += '?preview=synthetic' }],
  ])('withholds a release after %s', async (_name, mutate) => {
    const f = fixture(); mutate(f); expect(await check(f)).toBe(false)
  })
  it('does not authorize a release without its private source manifest', async () => {
    db.artifact.mockResolvedValue(null)
    expect(await hasCurrentResearchPermissions(fixture().dataset, tx)).toBe(false)
    expect(db.audits).not.toHaveBeenCalled()
  })

  it('withholds a draft manifest and a release whose copy changed after review', async () => {
    const f = fixture()
    db.artifact.mockResolvedValue({ kind: RESEARCH_PERMISSIONS_KIND, payload: f.manifest })
    expect(await hasCurrentResearchPermissions(f.dataset, tx)).toBe(false)
    const reviewedInputSha256 = researchReleaseInputSha256(f.dataset, f.manifest)
    db.artifact.mockResolvedValue({ kind: RESEARCH_PERMISSIONS_KIND,
      payload: { ...f.manifest, reviewedInputSha256, reviewedEvidenceSha256: '0'.repeat(64) } })
    f.dataset.issues[0].fixTemplate = 'Edited repair instructions.'
    expect(await hasCurrentResearchPermissions(f.dataset, tx)).toBe(false)
    expect(db.audits).not.toHaveBeenCalled()
  })

  it.each(['search-google-index', 'low-ctr', 'indexing-failure', 'soft-404'])(
    'withholds connected or ambiguous search evidence even above the sample floor (%s)', async checkId => {
      const f = fixture()
      f.dataset.issues[0].checkId = checkId
      f.flags.forEach(flag => { flag.checkId = checkId })
      expect(await check(f)).toBe(false)
    },
  )

  it('counts page variants by base identity and repeated rows only once', async () => {
    const f = fixture(); f.flags[0].checkId += '::page:1'; f.flags.push(f.flags[0])
    expect(await check(f)).toBe(true)
  })

  it('uses technology observations from affected source audits rather than a current hostname snapshot', async () => {
    const f = fixture(); f.dataset.issues[0].topFrameworks = [{ name: 'Next.js', siteCount: 20 }]
    const observations = f.audits.map((audit) => ({ id: 'framework-' + audit.id, technologyId: 'framework', auditId: audit.id, confidence: 0.95, detectorVersion: 'capture-v1',
      detectedAt: new Date('2026-09-05T00:30:00Z'), technology: { name: 'Next.js', kind: 'framework' } }))
    db.technologies.mockResolvedValue(observations)
    expect(await check(f)).toBe(true)
    const scope = f.audits[0].technologyObservationScope
    scope.finalUrl = 'https://outside.example/'
    expect(await check(f)).toBe(false)
    scope.finalUrl = 'https://site0.example/?preview=token'
    expect(await check(f)).toBe(false)
    scope.finalUrl = 'https://site0.example/store/..%2Felsewhere'
    expect(await check(f)).toBe(false)
    scope.finalUrl = 'https://site0.example/home'
    scope.access = 'credentialed:synthetic'
    expect(await check(f)).toBe(false)
    scope.access = 'public'
    expect(await check(f)).toBe(true)
    scope.finalUrl = 'https://site0.example/welcome'
    expect(await hasCurrentResearchPermissions(f.dataset, tx)).toBe(false)
    scope.finalUrl = 'https://site0.example/home'
    f.audits[0].technologyDetectorVersion = 'replacement-detector'
    expect(await check(f)).toBe(false)
    f.audits[0].technologyDetectorVersion = 'capture-v1'
    const timestamp = f.audits[0].technologyDetectedAt
    f.audits[0].technologyDetectedAt = observations[0].detectedAt = new Date('2026-09-05T02:00:00Z')
    expect(await check(f)).toBe(false)
    f.audits[0].technologyDetectedAt = observations[0].detectedAt = timestamp
    expect(await check(f)).toBe(true)
    observations[0].id = 'replacement-framework-observation'
    expect(await hasCurrentResearchPermissions(f.dataset, tx)).toBe(false)
    observations[0].detectedAt = new Date('2026-10-02T00:00:00Z')
    expect(await check(f)).toBe(false)
  })
})
