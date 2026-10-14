import { describe, expect, it } from 'vitest'
import { assessVerificationCoverage } from './verification-coverage'

const complete = {
  status: 'COMPLETED',
  reportCompleteness: 'FULL' as const,
  evidenceCoverage: { desktopScreenshot: true, metadata: true, aiAssessment: true },
  failedModules: [],
  journeyReviewIncluded: false,
  journeyReviewAt: null,
  pages: [{ url: 'https://example.com/', status: 'COMPLETED' }],
  source: 'DETERMINISTIC',
  checkId: 'cta-dead-link',
  pageUrl: 'https://example.com',
  verifierExecutions: [{
    targetKey: 'check:cta-dead-link',
    scopeKey: 'page:https://example.com',
    status: 'COMPLETED' as const,
    evidenceReference: { run: 'verification-1' },
  }],
}

describe('assessVerificationCoverage', () => {
  it.each(['failed-peer', 'missing-peer', 'repaired'] as const)('requires the original multi-page scope despite a successful representative-page verifier: %s', scenario => {
    const pageUrl = 'https://example.com/', peer = 'https://example.com/pricing'
    const receipt = (url: string, passed: boolean) => ({ targetKey: 'module:performance', scopeKey: 'page:' + url,
      status: 'COMPLETED' as const, evidenceReference: { taskId: url }, detail: {
        kind: 'site-module-check', version: 1, module: 'performance', pageUrl: url, applicable: true, passed, complete: true,
        execution: { auditId: 'after', taskId: url, checkVersion: 1, source: 'pagespeed-desktop', collectedAt: '2026-10-12T12:00:00.000Z' },
        assertions: [{ key: 'lcp', name: 'LCP', expected: 'Fast loading', observed: passed ? '1000ms' : '6000ms', passed, complete: true }],
      } })
    const main = receipt(pageUrl, true)
    const exact = { ...main, targetKey: 'check:lcp-poor', scopeKey: 'page:https://example.com', detail: {
      kind: 'check-verifier', version: 1, ...main.detail.execution, checkId: 'lcp-poor', pageUrl,
      comparable: true, verdict: 'passed', assertion: main.detail.assertions[0],
    } }
    const input = { ...complete, auditId: 'after', checkId: 'lcp-poor', pageUrl, reportCompleteness: 'PARTIAL' as const,
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
      originalFlag: { checkId: 'lcp-poor', pageUrl, affectedPaths: [pageUrl, peer], verificationRule: 'Comparable desktop LCP' },
      verifierExecutions: [main, exact, ...(scenario === 'missing-peer' ? [] : [receipt(peer, scenario === 'repaired')])],
    }
    const decision = assessVerificationCoverage(input)
    expect(decision.comparable).toBe(scenario !== 'missing-peer')
    if (scenario === 'failed-peer') expect(decision).toMatchObject({ verdict: 'failed' })
    if (scenario === 'repaired') expect(decision).toMatchObject({ verdict: 'passed' })
  })

  it.each(['proved', 'missing', 'other-page', 'other-responsibility', 'observed-only', 'old-version'] as const)('uses the same scoped module recovery proof as Flag closure: %s', scenario => {
    const pageUrl = 'https://example.com/'
    const input = { ...complete, auditId: 'after', checkId: scenario === 'other-responsibility' ? 'lang-missing' : 'viewport-missing', pageUrl,
      reportCompleteness: 'PARTIAL' as const, evidenceCoverage: {}, pages: [], failedModules: ['pagespeed'],
      originalFlag: { checkId: 'viewport-missing', pageUrl },
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'viewport-missing': 1 }, outcomes: [], verificationTarget: null },
      verifierExecutions: scenario === 'missing' ? [] : [{ targetKey: 'module:metadata', scopeKey: 'page:' + pageUrl, status: 'COMPLETED' as const,
        evidenceReference: { taskId: 'metadata-task' }, detail: { kind: 'site-module-check', version: 1, module: 'metadata', passed: true, applicable: true,
          pageUrl: scenario === 'other-page' ? 'https://example.com/elsewhere' : pageUrl,
          execution: { auditId: 'after', taskId: 'metadata-task', checkVersion: scenario === 'old-version' ? 2 : 1,
            source: 'rendered-dom', collectedAt: '2026-10-12T12:00:00.000Z' },
          assertions: [{ key: 'viewport-presence', name: 'Viewport', expected: 'Viewport present', observed: 'Viewport present', passed: true,
            ...(scenario === 'observed-only' ? { disposition: 'observed' } : {}) }],
        } }],
    }
    expect(assessVerificationCoverage(input).comparable).toBe(scenario === 'proved')
    if (scenario === 'proved') expect(assessVerificationCoverage(input).coverage.executionEvidenceReference).toMatchObject({ kind: 'recorded-recovery', auditId: 'after' })
  })

  it('accepts an exact HTTP assertion without a screenshot or unrelated module success', () => {
    const detail = { kind: 'check-verifier', version: 1, auditId: 'after', taskId: 'task',
      checkId: 'security-csp-missing', checkVersion: 1, pageUrl: 'https://example.com/', source: 'http',
      collectedAt: '2026-10-11T10:00:00.000Z', comparable: true, verdict: 'passed',
      assertion: { key: 'content-security-policy', name: 'CSP', expected: 'CSP is present', observed: 'CSP present', passed: true } }
    const input = { ...complete, auditId: 'after', checkId: detail.checkId,
      reportCompleteness: 'PARTIAL' as const, evidenceCoverage: {}, pages: [], failedModules: ['browser'],
      verifierExecutions: [{ ...complete.verifierExecutions[0], targetKey: 'check:security-csp-missing', detail }] }
    expect(assessVerificationCoverage(input).comparable).toBe(true)
    expect(assessVerificationCoverage({ ...input, verifierExecutions: [{ ...input.verifierExecutions[0],
      detail: { ...detail, auditId: 'another' } }] }).comparable).toBe(false)
  })
  it('accepts only a complete comparable verifier run', () => {
    expect(assessVerificationCoverage(complete)).toMatchObject({ comparable: true })
  })

  it('rejects a partial Review', () => {
    expect(assessVerificationCoverage({ ...complete, reportCompleteness: 'PARTIAL' }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/partial/i) })
  })

  it('rejects failed deterministic modules', () => {
    expect(assessVerificationCoverage({ ...complete, failedModules: ['interaction'] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/interaction/) })
  })

  it('rejects an omitted or unregistered exact verifier', () => {
    expect(assessVerificationCoverage({ ...complete, verifierExecutions: [] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/no positive execution record/i) })
  })

  it('does not allow Product Signals to substitute for verifier execution', () => {
    expect(assessVerificationCoverage({
      ...complete,
      evidenceCoverage: {
        ...complete.evidenceCoverage,
        productSignals: [{ kind: 'OUTCOME', name: 'signup_completed' }],
      },
      verifierExecutions: [],
    })).toMatchObject({ comparable: false })
  })

  it.each(['FAILED', 'NOT_APPLICABLE'] as const)(
    'rejects a target verifier with %s status',
    (status) => {
      expect(assessVerificationCoverage({
        ...complete,
        verifierExecutions: [{ ...complete.verifierExecutions[0], status }],
      })).toMatchObject({ comparable: false })
    },
  )

  it('rejects verifier provenance captured for a different page scope', () => {
    expect(assessVerificationCoverage({
      ...complete,
      verifierExecutions: [{
        ...complete.verifierExecutions[0],
        scopeKey: 'page:https://example.com/pricing',
      }],
    })).toMatchObject({ comparable: false })
  })

  it('rejects an omitted affected page', () => {
    expect(assessVerificationCoverage({ ...complete, pages: [] }))
      .toMatchObject({ comparable: false, reason: expect.stringMatching(/page/) })
  })

  it('requires the AI assessment for AI observations', () => {
    expect(assessVerificationCoverage({
      ...complete,
      source: 'AI',
      checkId: null,
      evidenceCoverage: { desktopScreenshot: true, metadata: true, aiAssessment: false },
      verifierExecutions: [],
    })).toMatchObject({ comparable: false })
  })

  it('preserves complete stable AI comparisons without borrowing a deterministic module responsibility', () => {
    expect(assessVerificationCoverage({ ...complete, auditId: 'after', source: 'AI', checkId: null, fingerprint: 'stable-ai',
      originalFlag: { checkId: null, pageUrl: complete.pageUrl },
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: complete.pageUrl, environment: 'production', scope: 'SITE',
        checks: { 'viewport-missing': 1 }, outcomes: [], verificationTarget: null },
      verifierExecutions: [{ ...complete.verifierExecutions[0], targetKey: 'ai:stable-ai' }],
    })).toMatchObject({ comparable: true })
  })

  it('requires journey evidence for journey observations', () => {
    expect(assessVerificationCoverage({
      ...complete,
      checkId: 'journey-signup-hidden-cta',
      verifierExecutions: [{
        targetKey: 'check:journey-signup-hidden-cta',
        scopeKey: 'page:https://example.com',
        status: 'COMPLETED',
        evidenceReference: { run: 'journey-verification-1' },
      }],
    })).toMatchObject({ comparable: false, reason: expect.stringMatching(/journey/) })
  })
})
