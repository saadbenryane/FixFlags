import { describe, expect, it } from 'vitest'
import { repairGuidanceState, repairGuidanceText } from '../repair-guidance'
import { observationsForFlag, publicSupportingObservations } from '@/lib/audit/flag-observations'

describe('repair guidance evidence custody', () => {
  const finding = { checkId: 'no-https', fix: 'Preserve the original source and repair its observed transport failure.' }
  const recorded = observationsForFlag({ ...finding, source: 'DETERMINISTIC', pageUrl: 'https://example.com/', evidence: 'Original response' },
    { auditId: 'audit', taskId: 'task', checkVersion: 1, collectedAt: '2026-10-20T12:00:00.000Z' })
  it('preserves usable guidance for native evidence, legacy findings and validated public projections', () => {
    for (const evidence of [{}, { supportingObservations: recorded },
      { supportingObservations: publicSupportingObservations(recorded), supportingEvidenceUnreadable: false }]) {
      expect(repairGuidanceText({ ...finding, ...evidence })).toBe(finding.fix)
      expect(repairGuidanceState({ ...finding, ...evidence })).toBe('ready')
    }
  })
  it('does not expose or promise guidance for an unreadable aggregate', () => {
    for (const evidence of [{ supportingObservations: { version: 99, items: [] } }, { supportingObservations: [] },
      { supportingEvidenceUnreadable: true }]) {
      expect(repairGuidanceText({ ...finding, ...evidence })).toBe('')
      expect(repairGuidanceState({ ...finding, ...evidence, audit: { includeAi: true, triageAt: new Date(), aiReviewAt: null } })).toBe('unavailable')
    }
  })
})
