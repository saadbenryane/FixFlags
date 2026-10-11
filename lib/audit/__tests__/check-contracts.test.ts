import { describe, expect, it } from 'vitest'
import { ALL_CHECK_IDS } from '../check-ids'
import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import { recordCheckObservations } from '../checks/observations'
import { checkReceiptSchema, readCheckReceipt } from '../checks/receipt'
import { isCustomerFlag } from '../attention'
import type { PageMetadata } from '../metadata'

describe('registered check and evidence contracts', () => {
  it('attributes every registered identity without using its legacy rubric', () => {
    expect(Object.keys(CHECK_REGISTRY)).toEqual([...ALL_CHECK_IDS])
    expect(CHECK_REGISTRY['flow-destination-no-cta'].area).toBe('conversion')
    expect(CHECK_REGISTRY['h1-generic'].area).toBe('conversion')
    expect(CHECK_REGISTRY['form-inputs-no-label'].area).toBe('accessibility')
    expect(CHECK_MODULES.measurement.area).toBe('tracking')
  })
  it('keeps heuristic guidance while reserving attention for observed material failures', () => {
    for (const checkId of ['flow-destination-no-cta', 'trust-no-authority-signals', 'messaging-weak-value-prop', 'security-csp-missing']) {
      expect(isCustomerFlag({ checkId, severity: 'CRITICAL', confidence: 1 })).toBe(false)
    }
    expect(isCustomerFlag({ checkId: 'flow-cta-404', severity: 'IMPORTANT', confidence: 1 })).toBe(true)
    expect(isCustomerFlag({ checkId: 'no-https', severity: 'CRITICAL', confidence: 1 })).toBe(true)
  })
  it('records only inspected inputs and never invents successful measurements', () => {
    const input = { url: 'https://example.com', metadata: { images: [{ src: 'http://example.com/a.png' }], hasAnalytics: false } as PageMetadata, desktop: null, mobile: null }
    expect(recordCheckObservations('security', input).map(item => item.passed)).toEqual([true, false])
    expect(recordCheckObservations('measurement', input)[0].passed).toBe(false)
    expect(recordCheckObservations('performance', input)).toEqual([])
    expect(recordCheckObservations('accessibility', input)).toEqual([])
    expect(recordCheckObservations('accessibility', { ...input, axe: [] })[0].passed).toBe(true)
  })
  it('validates new receipts and strips malformed historical assertions and private fields', () => {
    expect(checkReceiptSchema.safeParse({ kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: 'https://example.com', passed: true, applicable: true }).success).toBe(true)
    expect(readCheckReceipt({ version: 2, passed: true }).passed).toBeUndefined()
    expect(readCheckReceipt({ secret: 'never expose', assertions: [{ key: 'bad', passed: true }] })).toEqual({ passed: undefined, assertions: [], legacy: true })
  })
})
