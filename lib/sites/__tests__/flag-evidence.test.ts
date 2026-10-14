import { expect, it } from 'vitest'
import { flagEvidenceContext, performanceEvidenceSource } from '../flag-evidence'

it('retains source and locator provenance without projecting private comparison or request data', () => {
  const context = flagEvidenceContext({ auditId: 'original', source: 'DETERMINISTIC', createdAt: new Date('2026-10-14T00:00:00Z'),
    evidenceTargets: [{ selector: '#email', label: 'Email', device: 'desktop', context: 'secret', requestBody: 'private' }] })
  expect(context).toEqual({ auditId: 'original', source: 'DETERMINISTIC', recordedAt: '2026-10-14T00:00:00.000Z',
    references: [{ selector: '#email', label: 'Email', device: 'desktop' }] })
  expect(flagEvidenceContext({ auditId: 'historical' })).toMatchObject({ source: null, recordedAt: null, references: [] })
})

it('classifies the actual collector instead of attributing every Performance Flag to PageSpeed', () => {
  expect(performanceEvidenceSource('lcp-poor')).toBe('lab')
  expect(performanceEvidenceSource('mobile-lcp-critical')).toBe('lab')
  expect(performanceEvidenceSource('inp-poor')).toBe('field')
  expect(performanceEvidenceSource('mobile-input-zoom')).toBeNull()
  expect(performanceEvidenceSource('slow-3g-blank-screen')).toBeNull()
  expect(performanceEvidenceSource(null)).toBeNull()
})
