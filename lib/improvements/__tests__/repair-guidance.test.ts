import { describe, expect, it } from 'vitest'
import { repairGuidanceState, repairGuidanceText, prepareEvidenceRepairGuidance, resolveRepairDefinition } from '../repair-guidance'
import { isConditionalInspection } from '@/lib/audit/prescription-policy'
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
      expect(resolveRepairDefinition({ ...finding, ...evidence, problem: 'HTTPS unavailable', evidence: 'Original response' })).toMatchObject({ kind: 'evidence-recovery', source: 'evidence-recovery' })
    }
  })

  it.each(['mobile-lcp-critical', 'mobile-lcp-critical::page:123'])('prepares a measured loading plan when saved guidance is missing: %s', checkId => {
    const flag = { checkId, problem: 'Mobile LCP is critically slow (4.5s, target < 2.5s)', evidence: 'Largest Contentful Paint: 4.5s', fix: '' }
    const plan = prepareEvidenceRepairGuidance(flag)
    expect(plan).toContain('main image or text block')
    expect(plan).toContain('Do not assume every slow page has an image problem')
    expect(plan).toContain('fresh FixFlags check')
    expect(flag.fix).toBe('')
  })

  it('uses the same image recipe for preparation and stored-row receipt validation', () => {
    const flag = { checkId: 'unoptimized-images', problem: 'Images are not optimized', evidence: 'Image savings: 40MB', fix: 'Sign up to get the fix prompt.' }
    expect(prepareEvidenceRepairGuidance(flag)).toContain('size it is displayed')
    expect(repairGuidanceText(flag)).toBe(prepareEvidenceRepairGuidance(flag))
    expect(resolveRepairDefinition({ ...flag, evidence: '' })).toMatchObject({ kind: 'evidence-recovery' })
  })

  it('preserves an existing task and provides conditional inspection when the cause is unknown', () => {
    expect(prepareEvidenceRepairGuidance({ ...finding, problem: 'No HTTPS', evidence: 'Observed HTTP' })).toBe(finding.fix)
    const plan = prepareEvidenceRepairGuidance({ checkId: null, problem: 'A control did not respond', evidence: 'No change after activation', fix: '' })
    expect(plan).toContain('If you reproduce an unintended failure')
    expect(resolveRepairDefinition({ checkId: 'unknown-check', problem: 'A control did not respond', evidence: 'No change after activation' })).toMatchObject({ kind: 'investigation', recipeCheckVersion: null, source: 'investigation' })
    expect(plan).toContain('A control did not respond')
    expect(plan).not.toMatch(/app\/page|src\/|database|cache/)
    const contextual = prepareEvidenceRepairGuidance({ checkId: 'placeholder-copy-detected', problem: 'Example text', evidence: 'Example phrase', fix: 'Delete all examples.' })
    expect(isConditionalInspection(contextual)).toBe(true)
    expect(contextual).not.toContain('Delete all examples')
  })
})
