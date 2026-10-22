import { CHECK_REGISTRY } from '../check-registry'
import { describe, expect, it } from 'vitest'
import { readCheckReceipt } from './receipt'
import { runAllChecks } from './index'
import type { CaptureMetrics } from '../capture-metrics'
import { projectCheckResults } from '@/lib/sites/check-results'
import { parseMetadataFromHtml } from '../metadata'
import { evaluatorHandlers } from '../progressive/evaluators'
import { serializeArtifact, readArtifact } from '../progressive/contracts'
import { checkArtifactSchema } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'
import { NATIVE_CONSTRAINT_OBSERVATION } from './form-validation'

const pageUrl = 'https://example.com/'
const scope = { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' }
const assertion = { key: 'primary-action-count', name: 'Action style', expected: 'Comparable styles', observed: 'Complex paint prevents comparison',
  passed: false, complete: false, disposition: 'observed' as const }
const receipt = { kind: 'site-module-check', version: 1, module: 'cta-focus', pageUrl, passed: true, applicable: true,
  complete: true, assertions: [assertion] }

describe('check receipt summaries', () => {
  it('distinguishes unreadable current evidence from supported historical observations', () => {
    for (const detail of [null, { kind: 'site-module-check', version: 99 }, { ...receipt, assertions: [{ malformed: true }] }]) {
      expect(readCheckReceipt(detail)).toMatchObject({ unavailable: true })
      expect(projectCheckResults('audit', [{ id: 'unreadable', targetKey: 'module:cta-focus', pageUrl,
        status: 'COMPLETED', updatedAt: new Date(), detail }])).toMatchObject([{ status: 'unknown' }])
    }
    expect(readCheckReceipt({ passed: true })).toMatchObject({ passed: true, legacy: true, unavailable: false })
  })
  it('projects a recorded native shortcut as incomplete without altering its original receipt', () => {
    const original = { kind: 'site-module-check', version: 1, module: 'form-validation', pageUrl, passed: true, applicable: true,
      complete: true, assertions: [{ key: 'form-feedback', name: 'Feedback', expected: 'Immediate feedback',
        observed: NATIVE_CONSTRAINT_OBSERVATION, passed: true, complete: true }] }
    const saved = JSON.stringify(original)
    expect(readCheckReceipt(original)).toMatchObject({ passed: false, complete: false,
      assertions: [expect.objectContaining({ passed: true, complete: false })] })
    expect(JSON.stringify(original)).toBe(saved)
  })
  it.each([
    { module: 'form-validation', assertions: [{ key: 'form-feedback', observed: NATIVE_CONSTRAINT_OBSERVATION, passed: true, complete: true }] },
    { module: 'accessibility', assertions: [{ key: 'dom:form-inputs-no-label', observed: 'All controls have labels', passed: true, complete: true }] },
    { module: 'og-image', assertions: [{ key: 'preview-image-response', observed: 'HTTP 200', passed: true, complete: true }] },
    { module: 'cta-focus', assertions: [assertion] },
    { module: 'cta-focus', complete: false, assertions: [] },
    { module: 'cta-focus', failed: true, assertions: [] },
  ])('qualifies the historical $module summary with the same incomplete evidence rules', detail => {
    const original = { ...detail, passed: true, assertions: detail.assertions.map(item => ({
      name: 'Recorded observation', expected: 'Useful evidence', ...item,
    })) }
    const saved = structuredClone(original)
    expect(readCheckReceipt(original)).toMatchObject({ passed: false, complete: false, legacy: true, unavailable: false })
    const projected = projectCheckResults('audit', [{ id: 'legacy', targetKey: 'module:' + detail.module,
      pageUrl, status: 'COMPLETED', updatedAt: new Date(), detail: original }])
    expect(projected.every(result => result.status === 'unknown')).toBe(true)
    expect(projected.length).toBe(original.assertions.length + 1)
    expect(original).toEqual(saved)
  })
  it('preserves readable historical facts while withholding an unreadable aggregate', () => {
    const positive = { key: 'https', name: 'HTTPS', expected: 'HTTPS', observed: 'HTTPS', passed: true, complete: true }
    const original = { passed: true, assertions: [positive, { malformed: true }] }
    expect(readCheckReceipt(original)).toMatchObject({ passed: false, complete: false, legacy: true, unavailable: true, assertions: [positive] })
    expect(projectCheckResults('audit', [{ id: 'legacy', targetKey: 'module:security', pageUrl,
      status: 'COMPLETED', updatedAt: new Date(), detail: original }]).map(result => result.status)).toEqual(['passed', 'unknown'])
  })
  it.each([null, 'not an assertion list', { key: 'https' }])('withholds an unreadable historical assertion list: %j', assertions => {
    expect(readCheckReceipt({ passed: true, assertions })).toMatchObject({ passed: false, complete: false, unavailable: true })
  })
  it('retains historical failures and advisory semantics without inventing a recorded aggregate', () => {
    const failure = { key: 'https', name: 'HTTPS', expected: 'HTTPS', observed: 'HTTP', passed: false, complete: true }
    expect(readCheckReceipt({ passed: true, assertions: [failure] })).toMatchObject({ passed: false, assertions: [failure] })
    expect(readCheckReceipt({ assertions: [{ ...failure, passed: true }] }).passed).toBeUndefined()
    expect(readCheckReceipt({ passed: false, assertions: [{ ...failure, passed: true }] }).passed).toBe(false)
    expect(readCheckReceipt({ passed: true, assertions: [{ ...assertion, complete: true }] }))
      .toMatchObject({ passed: true, assertions: [{ passed: false, disposition: 'observed' }] })
    expect(readCheckReceipt({ passed: true })).not.toHaveProperty('complete')
  })
  it('keeps incomplete advisory evidence unknown even when a stored summary says it passed', () => {
    expect(readCheckReceipt(receipt)).toMatchObject({ passed: false, complete: false, assertions: [assertion] })
    expect(receipt).toMatchObject({ passed: true, complete: true })
    const results = projectCheckResults('audit', [{ id: 'receipt', targetKey: 'module:cta-focus', status: 'COMPLETED', pageUrl,
      updatedAt: new Date(), detail: receipt }])
    expect(results.map(result => result.status)).toEqual(['unknown', 'unknown'])
  })
  it('never replaces a recorded non-advisory failure with a passing module summary', () => {
    const failure = { key: 'https', name: 'HTTPS', expected: 'HTTPS', observed: 'HTTP', passed: false, complete: true }
    expect(readCheckReceipt({ ...receipt, module: 'security', assertions: [failure] })).toMatchObject({ passed: false, complete: true })
  })
  it('retains complete advisory observations without treating them as verified criterion passes', () => {
    expect(readCheckReceipt({ ...receipt, assertions: [{ ...assertion, complete: true }] }))
      .toMatchObject({ passed: true, complete: true, assertions: [{ passed: false, complete: true, disposition: 'observed' }] })
    expect(readCheckReceipt({ ...receipt, passed: false, assertions: [] }).passed).toBe(false)
    expect(readCheckReceipt({ ...receipt, failed: true, assertions: [] })).toMatchObject({ passed: false, complete: false })
    expect(readCheckReceipt({ passed: true })).toMatchObject({ passed: true, legacy: true, assertions: [] })
  })
  it('marks an unfinished native style comparison incomplete before it becomes a receipt', async () => {
    const metrics = { competingPrimaryCtaCount: 0, competingPrimaryCtaLabels: [], competingPrimaryCtaComplete: false,
      loadingObservation: { scope: { ...scope, profile: 'mobile' } } } as CaptureMetrics
    const checked = await runAllChecks(pageUrl, null, null, null, [], undefined, metrics, null, undefined, true, ['cta-focus'], { renderedScope: scope })
    expect(checked.flags).toEqual([])
    expect(checked.executions).toMatchObject([{ passed: false, complete: false,
      assertions: [{ complete: false, disposition: 'observed' }] }])
  })
  it('summarizes the accepted page-role findings after suppression without changing recorded advisory facts', async () => {
    const metadata = parseMetadataFromHtml('<main><h1>Acme information and services</h1><p>' +
      'We provide clear information about our services. Each page contains current details. '.repeat(8) + '</p></main>', pageUrl)
    const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
    async function observed(role: string) {
      const context = { audit: { id: 'audit', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
        environment: 'production', scope: 'SITE', checks: { 'messaging-no-audience': CHECK_REGISTRY['messaging-no-audience'].version }, outcomes: [], verificationTarget: null } },
        task: { id: 'check' }, input: { pageUrl, position: 0, primary: true, role, module: 'messaging-clarity' }, deadline: Date.now() + 5000,
        dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
          pageId: 'page', metadata, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopFinalUrl: pageUrl,
            desktopBase64: null, mobileBase64: null, consoleErrors: [], captureFailures: [], renderedScope: scope,
            captureStatus: { desktop: 'ok', mobile: 'pending' } },
        }) }]]),
      } as unknown as TaskContext
      return checkArtifactSchema.parse(readArtifact(await evaluate(context), 'check').data)
    }
    expect((await observed('primary')).flags.map(flag => flag.checkId)).toContain('messaging-no-audience')
    const trust = await observed('trust')
    expect(trust.flags).toEqual([])
    expect(trust.receipt.passed).toBe(true)
    expect(trust.receipt.execution).toMatchObject({ checkVersion: 3, checkVersions: { 'messaging-no-audience': CHECK_REGISTRY['messaging-no-audience'].version } })
    expect(trust.receipt.assertions.find(item => item.key === 'audience-or-outcome')).toMatchObject({ passed: false, complete: true, disposition: 'observed' })
  })
})
