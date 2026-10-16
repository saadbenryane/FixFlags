import { describe, expect, it } from 'vitest'
import { ALL_CHECK_IDS } from '../check-ids'
import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import { recordCheckObservations } from '../checks/observations'
import { checkReceiptSchema, readCheckReceipt } from '../checks/receipt'
import { isCustomerFlag } from '../attention'
import type { PageMetadata } from '../metadata'
import { registerPageEvaluators, PAGE_CHECKS } from '../checks/catalog'
import { PAGE_CHECK_DEFINITIONS } from '../checks/definitions'

describe('registered check and evidence contracts', () => {
  it('validates executable registration and rejects unsupported schemas or missing evaluators', () => {
    const entries = [...PAGE_CHECKS.values()]
    expect(registerPageEvaluators(entries).size).toBe(Object.keys(PAGE_CHECK_DEFINITIONS).length)
    expect(() => registerPageEvaluators(entries.slice(1))).toThrow('Missing')
    expect(() => registerPageEvaluators([...entries, entries[0]])).toThrow('Invalid')
    expect(() => registerPageEvaluators([{ ...entries[0], evaluate: undefined } as never], { [entries[0].id]: entries[0].definition })).toThrow('Invalid')
    expect(() => registerPageEvaluators([entries[0]], { [entries[0].id]: { ...entries[0].definition, resultSchema: 'unknown' } as never })).toThrow('Invalid')
  })
  it('attributes every registered identity without using its legacy rubric', () => {
    expect(Object.keys(CHECK_REGISTRY)).toEqual([...ALL_CHECK_IDS])
    expect(CHECK_REGISTRY['flow-destination-no-cta'].area).toBe('conversion')
    expect(CHECK_REGISTRY['h1-generic'].area).toBe('conversion')
    expect(CHECK_REGISTRY['form-inputs-no-label'].area).toBe('accessibility')
    expect(CHECK_MODULES.measurement.area).toBe('tracking')
  })
  it('preserves accepted non-Search Flag eligibility', () => {
    for (const checkId of ['flow-destination-no-cta', 'security-csp-missing']) {
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(true)
    }
    for (const checkId of ['messaging-weak-value-prop', 'trust-no-authority-signals'])
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(false)
    expect(isCustomerFlag({ checkId: 'flow-cta-404', severity: 'IMPORTANT', confidence: 1 })).toBe(true)
    expect(isCustomerFlag({ checkId: 'no-https', severity: 'CRITICAL', confidence: 1 })).toBe(true)
  })
  it('records only inspected inputs and never invents successful measurements', () => {
    const input = { url: 'https://example.com', metadata: { images: [{ src: 'http://example.com/a.png' }], hasAnalytics: false } as PageMetadata, desktop: null, mobile: null }
    expect(recordCheckObservations('security', input).map(item => item.passed)).toEqual([true, false])
    expect(recordCheckObservations('measurement', input)[0].passed).toBe(false)
    expect(recordCheckObservations('performance', input)).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'score', complete: false, passed: false }),
      expect.objectContaining({ key: 'lcp', complete: false, passed: false }),
      expect.objectContaining({ key: 'cls', complete: false, passed: false }),
    ]))
    expect(recordCheckObservations('performance', input).every(assertion => assertion.complete === false && !assertion.passed)).toBe(true)
    expect(recordCheckObservations('accessibility', input)).toEqual([])
    // An empty legacy violations list cannot establish that axe ran or passed.
    const historicalInput = { ...input, axe: [] }
    expect(recordCheckObservations('accessibility', historicalInput)).toEqual([])
  })
  it('validates new receipts and strips malformed historical assertions and private fields', () => {
    expect(checkReceiptSchema.safeParse({ kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: 'https://example.com', passed: true, applicable: true }).success).toBe(true)
    expect(readCheckReceipt({ version: 2, passed: true }).passed).toBeUndefined()
    expect(readCheckReceipt({ secret: 'never expose', assertions: [{ key: 'bad', passed: true }] })).toEqual({ passed: undefined, assertions: [], legacy: true })
  })
})
