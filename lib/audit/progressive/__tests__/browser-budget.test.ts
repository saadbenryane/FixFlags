import { describe, expect, it } from 'vitest'
import type { Audit } from '@prisma/client'
import { collectionHandlers } from '../collectors'
import { PAGE_TIMEOUT_MS } from '../../browser/page-session'

describe('frozen per-page browser observation budget', () => {
  it('retains both requested device windows without extending unrelated page budgets', () => {
    const handler = collectionHandlers.find(handler => handler.kind === 'browser')!
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production',
      checks: { 'console-errors-critical': 1 }, outcomes: [], verificationTarget: null,
      consoleObservationScopes: [{ pageUrl: 'https://example.com/observed', minimumMs: 90_000 }] }
    const audit = { executionSpec: spec } as unknown as Audit
    if (typeof handler.timeoutMs !== 'function') throw new Error('Browser budget must retain the recorded page windows')
    const input = { pageUrl: spec.targetUrl, position: 0, primary: true, role: 'primary' }
    expect(handler.timeoutMs(audit, input)).toBe(90_000)
    expect(handler.timeoutMs(audit, { ...input, pageUrl: spec.consoleObservationScopes[0].pageUrl }))
      .toBeGreaterThanOrEqual(2 * (90_000 + PAGE_TIMEOUT_MS))
  })
})
