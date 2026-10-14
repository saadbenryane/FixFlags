import { expect, it } from 'vitest'
import { flagEvidenceContext } from '../flag-evidence'

it('retains source and locator provenance without projecting private comparison or request data', () => {
  const context = flagEvidenceContext({ auditId: 'original', source: 'DETERMINISTIC', createdAt: new Date('2026-10-14T00:00:00Z'),
    evidenceTargets: [{ selector: '#email', label: 'Email', device: 'desktop', context: 'secret', requestBody: 'private' }] })
  expect(context).toEqual({ auditId: 'original', source: 'DETERMINISTIC', recordedAt: '2026-10-14T00:00:00.000Z',
    references: [{ selector: '#email', label: 'Email', device: 'desktop' }] })
  expect(flagEvidenceContext({ auditId: 'historical' })).toMatchObject({ source: null, recordedAt: null, references: [] })
})
