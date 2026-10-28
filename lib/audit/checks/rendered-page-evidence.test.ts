import { describe, expect, it, vi } from 'vitest'
import { runAllChecks } from './index'
import { parseMetadataFromHtml } from '../metadata'
import { scopeRenderedPageEvidence, RENDERED_PAGE_VERIFICATION_RULE } from './rendered-page-evidence'
import { scopedAssertionForTarget, recordAssertionVerifiers } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { checkReceiptSchema } from './receipt'

const url = 'https://example.test/'
const scope = { pageUrl: url, finalUrl: url, profile: 'native-desktop', access: 'public' }
async function inspect(source: string, captured = scope, module = 'trust') {
  const result = await runAllChecks(url, parseMetadataFromHtml(source, url), null, null, [], undefined, undefined, undefined,
    undefined, true, [module], { renderedScope: captured })
  const execution = result.executions[0]
  return { flags: result.flags, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, ...execution, pageUrl: url,
    execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-14T02:00:00.000Z' } }) }
}
describe('native page observation comparison', () => {
  it.each([
    { checkId: 'favicon-missing', declarations: ['<link rel="icon" href="/favicon.ico">', '<link rel="apple-touch-icon" href="/apple.png">'] },
    { checkId: 'og-image-missing', declarations: ['<meta property="og:image" content="https://example.test/preview.png">'] },
    { checkId: 'og-title-missing', declarations: ['<meta property="og:title" content="Useful reports">'] },
    { checkId: 'og-description-missing', declarations: ['<meta property="og:description" content="Prepare useful reports for your team">'] },
    { checkId: 'viewport-missing', declarations: ['<meta name="viewport" content="width=device-width, initial-scale=1">'] },
    { checkId: 'lang-missing', declarations: ['lang="en"'] },
  ])('independently observes $checkId repairs in the original rendered scope', async ({ checkId, declarations }) => {
    const source = '<!doctype html><html><head><title>Useful reports</title></head><body><main><h1>Useful reports</h1></main></body></html>'
    const repaired = (declaration: string) => checkId === 'lang-missing' ? source.replace('<html>', '<html ' + declaration + '>') : source.replace('</head>', declaration + '</head>')
    const before = await inspect(source, scope, 'metadata')
    const flag = { ...before.flags.find(flag => flag.checkId === checkId)!, pageUrl: url }
    expect(flag).toMatchObject({ checkId, verificationRule: RENDERED_PAGE_VERIFICATION_RULE })
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag })?.assertion).toMatchObject({ passed: false, complete: true })
    for (const declaration of declarations) {
      const after = await inspect(repaired(declaration), scope, 'metadata')
      expect(after.flags.some(flag => flag.checkId === checkId)).toBe(false)
      expect(scopedAssertionForTarget({ receipt: after.receipt, checkId, flag })?.assertion).toMatchObject({ passed: true, complete: true })
      expect(hasRecordedRecoveryEvidence({ auditId: 'after', flag,
        executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null },
        executions: [{ targetKey: 'module:metadata', status: 'COMPLETED', detail: after.receipt }] })).toBe(true)
    }
    const changed = await inspect(repaired(declarations[0]), { ...scope, access: 'credentialed:other' }, 'metadata')
    expect(scopedAssertionForTarget({ receipt: changed.receipt, checkId, flag })).toBeUndefined()
    const unavailable = await runAllChecks(url, null, null, null, [], undefined, undefined, undefined, undefined, true, ['metadata'], { renderedScope: scope })
    expect(unavailable.failedModules).toEqual([])
    expect(unavailable.flags).toEqual([])
    expect(unavailable.executions[0]).toMatchObject({ module: 'metadata', passed: false, complete: false, applicable: true,
      limitation: 'Page metadata was not collected. These observations remain unknown.', assertions: [] })
  })

  it('shares comparable repair and recurrence proof while refusing different capture conditions and old unscoped history', async () => {
    const before = await inspect('<main><h1>Useful service</h1></main>')
    const flag = { ...before.flags.find(flag => flag.checkId === 'no-privacy-policy')!, pageUrl: url }
    expect(flag.verificationRule).toBe(RENDERED_PAGE_VERIFICATION_RULE)
    const checkId = 'no-privacy-policy'
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: { [checkId]: 1 }, outcomes: [], verificationTarget: null }
    const upsert = vi.fn()
    const tx = {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  improvementAttempt: { findMany: vi.fn().mockResolvedValue([{ improvement: { occurrences: [{ flag }] } }]) }, auditVerifierExecution: { upsert, findMany: vi.fn().mockResolvedValue([]) } }
    for (const [captured, comparable] of [[scope, true], [{ ...scope, access: 'credentialed:other' }, false],
      [{ ...scope, profile: 'different-viewport' }, false], [{ ...scope, finalUrl: url + 'login' }, false], [{ ...scope, access: 'credentialed:unknown' }, false]] as const) {
      const after = await inspect('<main><h1>Useful service</h1><a href="/privacy">Privacy policy</a></main>', captured)
      expect(scopedAssertionForTarget({ receipt: after.receipt, checkId, flag })?.assertion.passed).toBe(comparable ? true : undefined)
      expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec, flag,
        executions: [{ targetKey: 'module:trust', status: 'COMPLETED', detail: after.receipt }] })).toBe(comparable)
      upsert.mockClear()
      await recordAssertionVerifiers({ auditId: 'after', parentId: 'before', primary: true, receipt: after.receipt }, tx as never)
      expect(upsert.mock.calls.length).toBe(comparable ? 1 : 0)
    }
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag: {} })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId, flag: { verificationRule: 'Confirm the privacy link on this page' } })).toBeUndefined()
  })
  it('retains detection with missing native conditions and requires the original mobile window', () => {
    const flag = { checkId: 'mobile-input-zoom', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Small input font', evidence: '12px font', fix: 'Use 16px', confidence: 1, source: 'DETERMINISTIC' }
    const assertion = { key: 'mobile-input-fonts', name: 'Input fonts', expected: '16px or more', observed: '12px', passed: false, complete: true }
    const before = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [flag], assertions: [assertion], desktop: scope,
      mobile: { ...scope, profile: 'native-mobile' } })
    expect(before.flags[0].problem).toBe(flag.problem)
    for (const changed of [{ desktop: scope }, { desktop: scope, mobile: { ...scope, profile: 'other-mobile' } }]) {
      const after = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [], assertions: [{ ...assertion, passed: true }], ...changed })
      expect(after.assertions[0].context).not.toBe(before.assertions[0].context)
    }
    const unavailable = scopeRenderedPageEvidence({ module: 'trust', flags: [flag], assertions: [assertion] })
    expect(unavailable.flags[0].evidenceTargets?.[0].context).toBe('rendered-page:unknown')
    expect(unavailable.assertions[0].complete).toBe(false)
  })
  it('verifies measured input sizing without requiring an unrelated complete desktop document', () => {
    const mobile = { ...scope, profile: 'native-mobile' }
    const control = 'mobile-input:' + 'a'.repeat(64)
    const flag = { checkId: 'mobile-input-zoom', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Small input font', evidence: '14px', fix: 'Use 16px', confidence: 1, source: 'DETERMINISTIC',
      evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'mobile' as const, selector: '#email', label: 'Email', context: control }] }
    const assertion = { key: 'mobile-input-fonts', name: 'Input fonts', expected: '16px or more', observed: '14px', passed: false, complete: true,
      context: control, targets: [{ selector: '#email', label: 'Email', context: control }] }
    const before = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [flag], assertions: [assertion], mobile })
    const make = (passed: boolean, captured = mobile) => {
      const result = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags: [], assertions: [{ ...assertion, passed }], mobile: captured })
      return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'mobile-ux-quality', applicable: true, passed,
        pageUrl: url, assertions: result.assertions, execution: { auditId: 'after', taskId: 'mobile', checkVersion: 2,
          source: 'rendered-dom', collectedAt: '2026-10-14T02:00:00.000Z' } })
    }
    for (const passed of [false, true]) {
      const receipt = make(passed)
      expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag: before.flags[0] })?.assertion.passed).toBe(passed)
      const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'DIAGNOSTIC',
        checks: { [flag.checkId]: 2 }, outcomes: [], verificationTarget: null }
      expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec, flag: { ...before.flags[0], pageUrl: url },
        executions: [{ targetKey: 'module:mobile-ux-quality', status: 'COMPLETED', detail: receipt }] })).toBe(passed)
      expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: { ...executionSpec, checks: { [flag.checkId]: 1 } },
        flag: { ...before.flags[0], pageUrl: url }, executions: [{ targetKey: 'module:mobile-ux-quality', status: 'COMPLETED', detail: receipt }] })).toBe(false)
    }
    expect(scopedAssertionForTarget({ receipt: make(true, { ...mobile, access: 'credentialed:other' }), checkId: flag.checkId, flag: before.flags[0] })).toBeUndefined()
    const missing = make(true)
    missing.assertions[0].targets = []
    expect(scopedAssertionForTarget({ receipt: missing, checkId: flag.checkId, flag: before.flags[0] })).toBeUndefined()
    const repeated = { ...before.flags[0], evidenceTargets: [...before.flags[0].evidenceTargets!, ...before.flags[0].evidenceTargets!] }
    expect(scopedAssertionForTarget({ receipt: make(true), checkId: flag.checkId, flag: repeated })).toBeUndefined()
    const enough = make(true)
    enough.assertions[0].targets = [...enough.assertions[0].targets!, ...enough.assertions[0].targets!]
    expect(scopedAssertionForTarget({ receipt: enough, checkId: flag.checkId, flag: repeated })?.assertion.passed).toBe(true)
    const peer = make(true, { ...mobile, pageUrl: url + 'about', finalUrl: url + 'about' })
    const peerContext = peer.assertions[0].context!
    const multiPage = { ...before.flags[0], evidenceTargets: [...before.flags[0].evidenceTargets!, { ...before.flags[0].evidenceTargets![0], context: peerContext }] }
    peer.assertions[0].targets = []
    expect(scopedAssertionForTarget({ receipt: enough, receipts: [peer], checkId: flag.checkId, flag: multiPage })).toBeUndefined()
    peer.assertions[0].targets = [{ selector: '#email', label: 'Email', context: peerContext }]
    expect(scopedAssertionForTarget({ receipt: make(true), receipts: [peer], checkId: flag.checkId, flag: multiPage })?.assertion.passed).toBe(true)
    const missingDesktop = scopeRenderedPageEvidence({ module: 'layout', flags: [], assertions: [{ ...assertion, context: undefined }], mobile })
    expect(missingDesktop.assertions[0].complete).toBe(false)
  })
  it('requires all original pages from the same execution when a finding has several affected paths', async () => {
    const first = await inspect('<main><h1>Useful service</h1></main>')
    const peerUrl = url + 'about'
    const peer = await inspect('<main><h1>Useful service</h1></main>', { ...scope, pageUrl: peerUrl, finalUrl: peerUrl })
    const original = { ...first.flags.find(flag => flag.checkId === 'no-privacy-policy')!, pageUrl: url, affectedPaths: [url, peerUrl],
      evidenceTargets: [...first.flags[0].evidenceTargets!, ...peer.flags[0].evidenceTargets!] }
    const healthy = '<main><h1>Useful service</h1><a href="/privacy">Privacy policy</a></main>'
    const after = await inspect(healthy)
    const other = await inspect(healthy, { ...scope, pageUrl: peerUrl, finalUrl: peerUrl })
    other.receipt = { ...other.receipt, pageUrl: peerUrl, execution: { ...other.receipt.execution!, taskId: 'peer-task' } }
    const compare = (receipts: typeof after.receipt[]) => scopedAssertionForTarget({ receipt: after.receipt, receipts,
      checkId: 'no-privacy-policy', flag: original })
    expect(compare([])).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: first.receipt, checkId: 'no-privacy-policy', flag: original })?.assertion)
      .toMatchObject({ passed: false, complete: true })
    expect(compare([other.receipt])?.assertion.passed).toBe(true)
    expect(compare([{ ...other.receipt, execution: { ...other.receipt.execution!, auditId: 'unrelated' } }])).toBeUndefined()
    expect(compare([{ ...other.receipt, execution: { ...other.receipt.execution!, checkVersion: 2 } }])).toBeUndefined()
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: { 'no-privacy-policy': 1 }, outcomes: [], verificationTarget: null }
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec, flag: original,
      executions: [after.receipt, other.receipt].map(detail => ({ targetKey: 'module:trust', status: 'COMPLETED', detail })) })).toBe(true)
  })
})
