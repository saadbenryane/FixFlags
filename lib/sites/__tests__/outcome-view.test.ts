import { describe, expect, it } from 'vitest'
import { projectOutcomeView, type OutcomeViewSource } from '../presentation/outcome-view'

const now = new Date('2026-10-16T12:00:00Z')
const binding = { key: 'page-loads', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1, config: { private: 'configuration' } }
const row: OutcomeViewSource = { id: 'o', name: 'Page loads', slug: 'page-loads', description: null, inferenceSource: 'browser', confirmedAt: now, pages: [{ pageId: 'p2' }, { pageId: 'p1' }], kind: 'AVAILABILITY', criticality: 'IMPORTANT', environment: 'production', enabled: true, staleAfterMinutes: 60, expectation: null, bindings: [binding], assessments: [], runSelections: [] }
const context = { now, bindingRevisions: [binding], pageUrls: ['https://example.com/two', 'https://example.com/one'] }
const assessment = { state: 'CLEAR' as const, summary: 'Page opened.', assessedAt: now, validUntil: new Date(now.getTime() + 60_000), improvementId: null, runRequestId: 'original', coverage: { environment: 'production', requiredBindings: ['page-loads'], bindings: [{ key: 'page-loads', version: 1, mechanism: 'HTTP_AVAILABILITY' }] } }

describe('pure Outcome presentation', () => {
  it('preserves supplied page order and strips executable configuration', () => {
    const result = projectOutcomeView(row, context)
    expect(result.pageIds).toEqual(['p2', 'p1'])
    expect(result.pageUrls).toEqual(context.pageUrls)
    expect(result.bindings[0]).not.toHaveProperty('config')
    expect(result.state).toBe('COULD_NOT_VERIFY')
  })
  it('uses the selected assessment and caller clock for freshness', () => {
    expect(projectOutcomeView({ ...row, assessments: [assessment] }, context)).toMatchObject({ state: 'CLEAR', validUntil: assessment.validUntil.toISOString() })
    expect(projectOutcomeView({ ...row, assessments: [assessment] }, { ...context, now: new Date(now.getTime() + 61_000) }).state).toBe('STALE')
  })
  it('keeps changed configuration unknown and preserves active request precedence', () => {
    const result = projectOutcomeView({ ...row, assessments: [assessment], runSelections: [{ runRequest: { id: 'new', status: 'RUNNING' } }] }, { ...context, bindingRevisions: [{ ...binding, version: 2 }] })
    expect(result).toMatchObject({ state: 'COULD_NOT_VERIFY', lastVerifiedAt: null, validUntil: null, latestRunId: 'new', running: true })
  })
  it('applies a tighter current freshness window without extending or rewriting the original assessment', () => {
    const assessedAt = new Date(now.getTime() - 2 * 86400_000)
    const recorded = { ...assessment, assessedAt, validUntil: new Date(assessedAt.getTime() + 8 * 86400_000) }
    const current = projectOutcomeView({ ...row, staleAfterMinutes: 13 * 60, assessments: [recorded] }, context)
    expect(current).toMatchObject({ state: 'STALE', lastVerifiedAt: assessedAt.toISOString(),
      validUntil: new Date(assessedAt.getTime() + 13 * 3600_000).toISOString() })
    expect(recorded.validUntil).toEqual(new Date(assessedAt.getTime() + 8 * 86400_000))
  })
  it('does not revive an expired observation by selecting a looser freshness policy', () => {
    const expired = { ...assessment, validUntil: new Date(now.getTime() - 1000) }
    expect(projectOutcomeView({ ...row, staleAfterMinutes: 8 * 24 * 60, assessments: [expired] }, context))
      .toMatchObject({ state: 'STALE', validUntil: expired.validUntil.toISOString() })
  })
})
