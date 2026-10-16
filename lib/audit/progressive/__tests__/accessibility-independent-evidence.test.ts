import { describe, expect, it } from 'vitest'
import { evaluatorHandlers } from '../evaluators'
import { serializeArtifact, readArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import type { TaskContext } from '../registry'
import type { AccessibilityEvidence } from '../../browser/accessibility-evidence'
import { scopedAssertionForTarget } from '../../checks/verification'
import { ACCESSIBILITY_VERIFICATION_RULE } from '../../checks/accessibility-rules'
import { accessibilityObservations } from '../../checks/accessibility-observations'
import { healthyMeta } from '../../__tests__/check-fixtures'

const pageUrl = 'https://example.com/'
const scope = { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' }
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
async function observed(state: AccessibilityEvidence['rules'][number]['state'], available = true) {
  const evidence = { scope, engine: 'fixture-engine', rules: [{ id: 'button-name', state, nodes: 1 }] }
  const context = {
    audit: { id: 'after', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', checks: { 'buttons-no-text': 1 }, outcomes: [], verificationTarget: null } },
    task: { id: 'check' }, input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'accessibility' },
    deadline: Date.now() + 10_000,
    dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
      pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopHtmlTruncated: true,
        desktopFinalUrl: pageUrl, desktopBase64: null, mobileBase64: null, consoleErrors: [], captureFailures: [],
        captureStatus: { desktop: 'ok', mobile: 'pending' }, renderedScope: scope,
        ...(available ? { accessibilityEvidence: evidence, axeViolations: state === 'failed' ? [{ id: 'button-name', impact: 'serious',
          description: 'Name required', help: 'Name required', helpUrl: 'https://example.com/rule',
          nodes: [{ target: ['#submit'], html: '<button id="submit"></button>', failureSummary: 'Add an accessible name' }] }] : [] } : {}),
      },
    }) }]]),
  } as unknown as TaskContext
  return checkArtifactSchema.parse(readArtifact(await evaluate(context), 'check').data)
}

describe('independent native Accessibility evaluation', () => {
  it('retains native failure, comparable repair and recurrence while full metadata is unavailable', async () => {
    const before = await observed('failed'), flag = before.flags[0]
    expect(flag).toMatchObject({ checkId: 'buttons-no-text', verificationRule: ACCESSIBILITY_VERIFICATION_RULE })
    const repaired = await observed('passed')
    expect(repaired.flags).toEqual([])
    expect(repaired.receipt).toMatchObject({ applicable: true, complete: false, passed: false })
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: flag.checkId, flag })?.assertion)
      .toMatchObject({ passed: true, complete: true })
    expect((await observed('failed')).flags[0].evidenceTargets).toEqual(flag.evidenceTargets)
    expect(scopedAssertionForTarget({ receipt: (await observed('incomplete')).receipt, checkId: flag.checkId, flag })).toBeUndefined()
  })
  it('never uses native success or unavailable rule results to certify a missing HTML fallback', async () => {
    const dom = accessibilityObservations({ metadata: healthyMeta({ buttonsWithoutText: 1 }), scope })
      .find(assertion => assertion.key === 'dom:buttons-no-text')!
    const flag = { verificationRule: ACCESSIBILITY_VERIFICATION_RULE, evidenceTargets: [{ context: dom.context! }] }
    for (const result of [await observed('passed'), await observed('passed', false)]) {
      expect(result.receipt.assertions.find(assertion => assertion.key === 'dom:buttons-no-text'))
        .toMatchObject({ passed: false, complete: false })
      expect(scopedAssertionForTarget({ receipt: result.receipt, checkId: 'buttons-no-text', flag })).toBeUndefined()
    }
  })
})
