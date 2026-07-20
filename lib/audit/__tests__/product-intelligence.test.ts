import { describe, expect, it } from 'vitest'
import {
  appendIntentionalNote,
  appendVerifiedLearning,
  canonicalProductUrl,
  contractFromProductIntelligence,
  mergeHeuristicIntoProjectPi,
  parseProductIntelligence,
  productIntelligenceFromContract,
  resolveContractForCapture,
} from '@/lib/audit/product-intelligence'
import type { ProductContract } from '@/lib/audit/product-contract'

const heuristic: ProductContract = {
  purpose: 'Help founders launch AI apps',
  firstValueJourney: 'Paste a URL and get a Finish Plan',
  criticalOutcomes: ['Primary CTA works', 'Signup completes'],
  inferredAt: '2026-07-20T00:00:00.000Z',
  source: 'heuristic',
}

describe('product-intelligence', () => {
  it('canonicalizes product URLs', () => {
    expect(canonicalProductUrl('https://www.Example.com/path')).toBe('https://example.com')
  })

  it('prefers user PI over fresh heuristic', () => {
    const userPi = productIntelligenceFromContract({
      ...heuristic,
      purpose: 'User-corrected purpose',
      source: 'user',
    })
    const resolved = resolveContractForCapture(heuristic, userPi)
    expect(resolved.purpose).toBe('User-corrected purpose')
    expect(resolved.source).toBe('user')
  })

  it('does not overwrite user PI when merging heuristic', () => {
    const userPi = productIntelligenceFromContract({
      ...heuristic,
      purpose: 'Locked purpose',
      source: 'user',
    })
    const merged = mergeHeuristicIntoProjectPi(userPi, {
      ...heuristic,
      purpose: 'New heuristic purpose',
    })
    expect(merged.purpose).toBe('Locked purpose')
    expect(merged.source).toBe('user')
  })

  it('round-trips contract ↔ intelligence', () => {
    const pi = productIntelligenceFromContract(heuristic)
    const back = contractFromProductIntelligence(pi)
    expect(back.purpose).toBe(heuristic.purpose)
    expect(parseProductIntelligence(pi)?.criticalOutcomes).toEqual(heuristic.criticalOutcomes)
  })

  it('appends verified learnings and intentional notes', () => {
    let pi = productIntelligenceFromContract(heuristic)
    pi = appendVerifiedLearning(pi, {
      checkId: 'cta-missing',
      summary: 'Verified fixed: CTA missing',
      auditId: 'audit-1',
      at: '2026-07-20T12:00:00.000Z',
    })
    pi = appendIntentionalNote(pi, 'Pricing page is intentionally minimal')
    expect(pi.verifiedLearnings?.[0]?.checkId).toBe('cta-missing')
    expect(pi.intentionalNotes?.[0]).toContain('intentionally')
  })
})
