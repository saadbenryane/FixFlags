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
    expect(projectOutcomeView({ ...row, assessments: [assessment] }, context).state).toBe('CLEAR')
    expect(projectOutcomeView({ ...row, assessments: [assessment] }, { ...context, now: new Date(now.getTime() + 61_000) }).state).toBe('STALE')
  })
  it('keeps changed configuration unknown and preserves active request precedence', () => {
    const result = projectOutcomeView({ ...row, assessments: [assessment], runSelections: [{ runRequest: { id: 'new', status: 'RUNNING' } }] }, { ...context, bindingRevisions: [{ ...binding, version: 2 }] })
    expect(result).toMatchObject({ state: 'COULD_NOT_VERIFY', lastVerifiedAt: null, validUntil: null, latestRunId: 'new', running: true })
  })
})
