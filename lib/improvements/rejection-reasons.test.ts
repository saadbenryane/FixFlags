import { describe, expect, it } from 'vitest'
import {
  IMPROVEMENT_REJECTION_REASONS,
  normalizeImprovementRejectionReason,
} from './rejection-reasons'

describe('Improvement rejection reasons', () => {
  it('keeps the seven judgment-learning reasons explicit', () => {
    expect(IMPROVEMENT_REJECTION_REASONS).toEqual([
      'WRONG',
      'ALREADY_KNOWN',
      'LOW_IMPACT',
      'POOR_TIMING',
      'TOO_COSTLY',
      'WEAK_RECOMMENDATION',
      'MISUNDERSTOOD_PRODUCT_CONTEXT',
    ])
  })

  it('normalizes rolling-deploy legacy feedback without treating already-fixed as rejection', () => {
    expect(normalizeImprovementRejectionReason('incorrect')).toBe('WRONG')
    expect(normalizeImprovementRejectionReason('low_priority')).toBe('LOW_IMPACT')
    expect(normalizeImprovementRejectionReason('already_fixed')).toBeNull()
  })
})
