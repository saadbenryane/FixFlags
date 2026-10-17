import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), persist: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUniqueOrThrow: fixture.read },
  $transaction: async (work: (tx: unknown) => Promise<void>) => work({ auditVerifierExecution: { create: fixture.create } }) } }))
vi.mock('@/lib/audit/persist', () => ({ persistDeterministicFlags: fixture.persist }))
import { persistControlledNativeSource } from './controlled-native-source'

const pageUrl = 'https://example.com/'
const flag = { checkId: 'unoptimized-images', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Large image',
  evidence: 'The controlled provider returned an image optimization opportunity.', fix: 'Optimize the image', confidence: 1, source: 'DETERMINISTIC' as const }
const scores = { MESSAGE: null, EXPERIENCE: null, REACH: null }
beforeEach(() => {
  vi.clearAllMocks()
  fixture.read.mockResolvedValue({ url: pageUrl, executionSpec: null })
  fixture.create.mockResolvedValue({ id: 'actual-created-collection-row' })
})
describe('controlled native source custody', () => {
  it('requires declared methods and rejects mismatched current collector versions before recording evidence', async () => {
    await expect(persistControlledNativeSource('audit', [flag], scores)).rejects.toThrow('explicitly declared')
    await expect(persistControlledNativeSource('audit', [flag], scores, { 'unoptimized-images': 2 })).rejects.toThrow('does not match')
    expect(fixture.create).not.toHaveBeenCalled()
    expect(fixture.persist).not.toHaveBeenCalled()
  })
  it('records actual source custody for every raw page before grouping without claiming worker execution or collection time', async () => {
    await persistControlledNativeSource('audit', [{ ...flag, pageUrl }, { ...flag, pageUrl: pageUrl + 'pricing' }], scores, { 'unoptimized-images': 1 })
    const data = fixture.create.mock.calls[0][0].data
    expect(data.targetKey).toMatch(/^fixture:controlled-native:/)
    expect(data).not.toHaveProperty('workKind')
    expect(data).not.toHaveProperty('workState')
    expect(data.detail).toMatchObject({ kind: 'controlled-native-source', collectedAt: null, methods: { 'unoptimized-images': 1 } })
    const recorded = fixture.persist.mock.calls[0][1]
    expect(recorded.map((item: typeof flag & { supportingObservations: { items: { pageUrl: string }[] } }) => item.supportingObservations.items[0].pageUrl)).toEqual([pageUrl, pageUrl + 'pricing'])
    for (const item of recorded) expect(item.supportingObservations.items[0]).toMatchObject({ checkVersion: 1,
      provenance: { auditId: 'audit', taskId: 'actual-created-collection-row', collectedAt: null } })
  })
  it('refuses to relabel previously stored observations as a new controlled collection', async () => {
    await expect(persistControlledNativeSource('audit', [{ ...flag, supportingObservations: { version: 1, items: [] } }], scores,
      { 'unoptimized-images': 1 })).rejects.toThrow('cannot rewrite')
    expect(fixture.create).not.toHaveBeenCalled()
  })
})
