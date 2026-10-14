import type { Page } from 'playwright'
import { auditPageObservation, captureObservationKey } from './observation-scope'
import { readOverlayControls } from './overlay-observation'
import { observeViewport } from './viewport-observation'
import { detectOverlayAtPoint, severityForOverlayBlocker, type OverlayBlockerInfo } from './overlay-probe'
import { overlayControlContext, type OverlayObservation, type OverlayTarget } from '../checks/overlay-evidence'

export type OverlayInspection = { observation?: OverlayObservation; blocker: OverlayBlockerInfo | null; matchesExpected: boolean }
/** Observe the actual interaction phase. A click trial exercises hover and
 * pointer eligibility without dispatching the activation or a form submission. */
export function createOverlayInteractionRecorder(page: Page, options: { deadline?: number; restricted?: () => boolean; expectedTargets?: OverlayTarget[] } = {}) {
  const recorded = new Map<string, OverlayObservation>()
  const store = (observation: OverlayObservation, completedActivation = false) => {
    const context = observation.controls[0]?.context
    if (!context || recorded.size >= 100 && !recorded.has(context)) return
    const previous = recorded.get(context)
    const rank = { failed: 2, unknown: 1, passed: 0 }
    if (!previous || completedActivation && previous.controls[0].disposition === 'unknown' ||
      rank[observation.controls[0].disposition] >= rank[previous.controls[0].disposition]) recorded.set(context, observation)
  }
  return {
    observations: () => {
      const source = auditPageObservation(page)
      if (source) for (const target of options.expectedTargets ?? []) if (!recorded.has(target.context)) store({
        version: 1, device: source.device, scope: source.scope, phase: target.context.split(':')[3], complete: false,
        contentVisible: false, restricted: source.restricted, controls: [{ ...target, disposition: 'unknown', reason: 'unavailable', blocker: null }] })
      return [...recorded.values()].map(observation => ({ ...observation,
        restricted: observation.restricted || source?.restricted === true || options.restricted?.() === true }))
    },
    expectedSelector: (kind: OverlayTarget['kind'], phase: string) => options.expectedTargets?.find(target => target.kind === kind &&
      [phase, phase + '_after'].includes(target.context.split(':')[3]))?.selector,
    activationRequired: (phase: string) => !options.expectedTargets?.length || !options.expectedTargets.some(target => target.context.split(':')[3] === phase) ||
      options.expectedTargets.some(target => target.context.split(':')[3] === phase + '_after'),
    activated(inspection: OverlayInspection | undefined) {
      const before = inspection?.observation
      if (!before || before.controls.length !== 1 || before.controls[0].disposition !== 'passed') return
      const phase = (before.phase ?? 'page_load') + '_after', parts = before.controls[0].context.split(':'); parts[3] = phase
      store({ ...before, phase, restricted: before.restricted || auditPageObservation(page)?.restricted === true || options.restricted?.() === true,
        controls: [{ ...before.controls[0], context: parts.join(':'), disposition: 'passed', reason: 'clear', blocker: null }] }, true)
    },
    async inspect(selector: string, kind: OverlayTarget['kind'], phase: string): Promise<OverlayInspection> {
      const source = auditPageObservation(page)
      if (!source || captureObservationKey(source.scope) === 'unknown') return { blocker: null, matchesExpected: true }
      try {
        const timeout = Math.max(1, Math.min(500, (options.deadline ?? Date.now() + 500) - Date.now()))
        await page.locator(selector).first().scrollIntoViewIfNeeded({ timeout })
        const frame = await readOverlayControls(page, [selector], [selector], kind)
        const control = frame.controls[0]
        if (!control || !frame.complete || frame.pageUrl !== source.scope.finalUrl) return { blocker: null, matchesExpected: false }
        const content = await observeViewport(page, { profile: 'overlay-interaction', includeActions: false, excludeLoading: true })
        const context = overlayControlContext(source.scope, kind, control.identity, phase)
        const expected = options.expectedTargets?.filter(target => target.kind === kind && [phase, phase + '_after'].includes(target.context.split(':')[3]))
        const matchesExpected = !expected?.length || expected.some(target => {
          const parts = context.split(':'); parts[3] = target.context.split(':')[3]; return parts.join(':') === target.context
        })
        let passed = false
        if (matchesExpected) try { await page.locator(selector).first().click({ trial: true, timeout }); passed = true } catch { /* Observe the actual cover after the bounded trial. */ }
        const blocker = !passed && matchesExpected ? await detectOverlayAtPoint(page, selector) : null
        const after = await readOverlayControls(page, [selector], [selector], kind)
        const current = after.controls.find(item => item.identity === control.identity)
        const same = Boolean(current) && after.pageUrl === frame.pageUrl && page.url() === frame.pageUrl
        let disposition: 'passed' | 'failed' | 'unknown' = !matchesExpected || !same ? 'unknown' : passed || !blocker && current?.receivesPointer ? 'passed' : blocker && severityForOverlayBlocker(blocker) ? 'failed'
          : blocker?.looksLikeConsentChrome || blocker && !severityForOverlayBlocker(blocker) ? 'passed' : 'unknown'
        // After a failed activation, a momentarily clear target is insufficient.
        // Only activated() records positive proof for the post-attempt phase.
        if (phase.endsWith('_after') && disposition === 'passed') disposition = 'unknown'
        const observation: OverlayObservation = { version: 1, device: source.device, scope: source.scope, phase, complete: same && frame.ready && after.ready,
          contentVisible: content.content && content.pageUrl === frame.pageUrl, restricted: source.restricted || auditPageObservation(page)?.restricted === true || options.restricted?.() === true,
          controls: [{ kind, selector: control.selector, label: control.label, context, disposition,
            reason: disposition === 'failed' ? 'persistent_overlay' : disposition === 'unknown' ? 'unavailable' : blocker?.looksLikeConsentChrome ? 'consent_chrome' : 'clear', blocker }] }
        store(observation)
        return { observation, blocker, matchesExpected }
      } catch { return { blocker: null, matchesExpected: false } }
    },
  }
}
export type OverlayInteractionRecorder = ReturnType<typeof createOverlayInteractionRecorder>
