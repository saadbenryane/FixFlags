import { createHash } from 'node:crypto'
import type { Page, JSHandle } from 'playwright'
import { detectOverlayAtPoint, type OverlayBlockerInfo } from '@/lib/audit/browser/overlay-probe'
import type { ProbeOutcome } from './nav-probes'
import type { FormEvidence } from './form-evidence'
import { sleep } from '@/lib/utils/sleep'

export interface FormProbeResult {
  formValidation: ProbeOutcome
  formLabel?: string
  feedbackMs?: number | null
  formOverlay?: OverlayBlockerInfo | null
  evidence?: FormEvidence
}

/** Observe an empty form. Isolated probes allow local validation handlers while
 * preventing native submission and every outbound request until session close. */
export async function probeFormValidation(page: Page, options: {
  isolated?: boolean; localValidationToken?: string; deadline?: number; safetyRefused?: () => boolean
  expectedTargets?: Array<{ context: string; selector: string; label: string }>
} = {}): Promise<FormProbeResult> {
  const candidates = await page.evaluate(() => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
      for (let parent = element.parentElement; parent; parent = parent.parentElement)
        if (getComputedStyle(parent).opacity === '0') return false
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && !element.closest('[hidden], [inert]')
    }
    const allForms = [...document.querySelectorAll('main form, [role="main"] form, form:not(header form):not(nav form)')]
    const forms = allForms.slice(0, 40)
    const candidates = []
    for (const [index, element] of forms.entries()) {
      const form = element as HTMLFormElement
      if (form.closest('header, nav, [role="navigation"], [role="search"]')) continue
      if (form.closest('[hidden], [inert]')) continue
      const controls = [...form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="search"]), textarea, select')]
      const fields = controls.slice(0, 100).filter(visible) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      const incomplete = controls.length > 100 || form.action.length > 2048 || fields.some(field => field.name.length > 200 || field.id.length > 200)
      if (!incomplete && !fields.some(field => field.required || field.getAttribute('aria-required') === 'true')) continue
      const submit = [...form.querySelectorAll('button, input[type="submit"]')].find(element =>
        visible(element) && ((element as HTMLButtonElement).type === 'submit' || !element.getAttribute('type')))
      const label = (form.getAttribute('aria-label') || form.querySelector('legend')?.textContent?.trim() || submit?.textContent?.trim() || 'Conversion form').slice(0, 160)
      form.setAttribute('data-fixflags-form-probe', String(index))
      candidates.push({ selector: `form[data-fixflags-form-probe="${index}"]`, label, hasSubmit: Boolean(submit), incomplete,
        prefilled: fields.some(field => (field.required || field.getAttribute('aria-required') === 'true') &&
          (field instanceof HTMLInputElement && ['checkbox', 'radio'].includes(field.type) ? field.checked : field.value.trim().length > 0)),
        signature: JSON.stringify({ form: (form.getAttribute('name') || form.id || String(index)).slice(0, 200), action: form.action.slice(0, 2048),
          fields: fields.map(field => ({ name: (field.name || field.id).slice(0, 200), tag: field.tagName })) }) })
    }
    return { candidates, incomplete: allForms.length > 40 }
  })
  const pageUrl = page.url()
  const scoped = candidates.candidates.map(candidate => ({ ...candidate,
    context: 'form:' + createHash('sha256').update(JSON.stringify([pageUrl, candidate.signature])).digest('hex') }))
  const formMeta = options.expectedTargets?.length ? scoped.find(candidate => options.expectedTargets!.some(target => target.context === candidate.context)) : scoped[0]
  if (!formMeta) {
    const expected = options.expectedTargets?.[0] ?? (candidates.incomplete ? { selector: 'form', label: 'Conversion form inventory',
      context: 'form:' + createHash('sha256').update(pageUrl + ':inventory').digest('hex') } : undefined)
    return expected ? { formValidation: 'skipped', evidence: { version: 1, pageUrl, ...expected,
      disposition: 'unknown', reason: candidates.incomplete ? 'observation_incomplete' : 'form_unavailable', feedbackMs: null } } : { formValidation: 'skipped' }
  }
  const { selector, context } = formMeta
  const submitSelector = `${selector} button[type="submit"], ${selector} input[type="submit"], ${selector} button:not([type])`
  const finish = (disposition: FormEvidence['disposition'], reason: FormEvidence['reason'], feedbackMs: number | null = null,
    formOverlay?: OverlayBlockerInfo | null): FormProbeResult => ({
    formValidation: disposition === 'passed' ? 'ok' : disposition === 'failed' ? 'broken' : 'skipped',
    formLabel: formMeta.label, feedbackMs, formOverlay,
    evidence: { version: 1, pageUrl, selector, context, label: formMeta.label, disposition, reason, feedbackMs },
  })
  if (formMeta.incomplete) return finish('unknown', 'observation_incomplete')
  if (formMeta.prefilled) return finish('unknown', 'prefilled_fields')
  if (!formMeta.hasSubmit) return finish('failed', 'missing_submit')
  let requestRefused = false
  if (options.isolated) await page.route('**', async route => {
    requestRefused = true
    await route.abort('blockedbyclient')
  })
  const refused = () => requestRefused || options.safetyRefused?.() === true
  let timing: JSHandle<{ setChecker(checker: () => boolean): void; read(): number | null; dispose(): void }> | undefined
  try {
    if (options.isolated) timing = await page.evaluateHandle(sel => {
      const form = document.querySelector(sel)!
      let clickedAt: number | null = null, feedbackAt: number | null = null, checker: (() => boolean) | undefined, frame = 0
      const inspect = () => {
        if (clickedAt !== null && feedbackAt === null && performance.now() - clickedAt <= 2000 && checker?.()) feedbackAt = performance.now()
      }
      const tick = () => { inspect(); if (clickedAt !== null && feedbackAt === null && performance.now() - clickedAt <= 2000) frame = requestAnimationFrame(tick) }
      const clicked = (event: Event) => { if (event.isTrusted && clickedAt === null) { clickedAt = event.timeStamp; frame = requestAnimationFrame(tick) } }
      form.addEventListener('click', clicked, true)
      const observer = new MutationObserver(inspect)
      observer.observe(form, { subtree: true, attributes: true, childList: true, characterData: true })
      return { setChecker(value: () => boolean) { checker = value }, read() { inspect(); return clickedAt !== null && feedbackAt !== null ? feedbackAt - clickedAt : null },
        dispose() { observer.disconnect(); cancelAnimationFrame(frame); form.removeEventListener('click', clicked, true) } }
    }, selector)
    const readState = (native: boolean) => page.evaluate(({ sel, native, tracker }) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
      const form = document.querySelector(sel) as HTMLFormElement | null
      if (!form) return null
      const nativeInvalid = native && !form.noValidate && !form.checkValidity()
      const isFeedback = (node: Element) => {
          const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
          for (let parent = node.parentElement; parent; parent = parent.parentElement)
            if (getComputedStyle(parent).opacity === '0') return false
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' &&
            style.opacity !== '0' && !node.closest('[hidden]') && (node.getAttribute('aria-invalid') === 'true' || Boolean(node.textContent?.trim()))
      }
      const references = () => [...form.querySelectorAll('[aria-errormessage]')].flatMap(field =>
        (field.getAttribute('aria-errormessage') ?? '').split(/\s+/).map(id => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node)))
      const localFeedback = () => [...form.querySelectorAll('[aria-invalid="true"], [role="alert"], [aria-live="assertive"], [class*="error" i], [id*="error" i], .invalid-feedback'), ...references()].some(isFeedback)
      const feedback = localFeedback()
      const referenced = references()
      tracker?.setChecker(localFeedback)
      const outside = [...document.querySelectorAll('[role="alert"], [aria-live="assertive"]')].filter(node => !form.contains(node) && !referenced.includes(node as HTMLElement) && isFeedback(node)).length
      return { native: nativeInvalid, feedback, outside, text: form.textContent?.slice(0, 64_000),
        suppressed: form.hasAttribute('data-fixflags-submit-suppressed') }
    }, { sel: selector, native, tracker: timing ?? null })

    const baseline = await readState(true)
    if (!baseline) return finish('unknown', 'form_changed')
    if (refused()) return finish('unknown', 'submission_blocked')
    if (baseline.native) return finish('passed', 'native_validation', 0)
    if (baseline.feedback) return finish('unknown', 'preexisting_feedback')
    const observationBudget = Math.max(0, Math.min(2000, (options.deadline ?? Date.now() + 2000) - Date.now()))
    if (!observationBudget) return finish('unknown', 'observation_incomplete')
    if (options.isolated && options.localValidationToken) await page.evaluate(({ sel, token }) => {
      document.querySelector(sel)?.setAttribute('data-fixflags-local-validation', token)
    }, { sel: selector, token: options.localValidationToken })
    const submit = await page.$(submitSelector)
    if (!submit) return finish('unknown', 'form_changed')
    const startedAt = Date.now()
    await submit.click({ timeout: Math.max(1, observationBudget) })
    const observedFeedback = async () => timing ? await timing.evaluate(tracker => tracker.read()) : null
    while (Date.now() - startedAt <= observationBudget) {
      if (refused()) return finish('unknown', 'submission_blocked')
      if (page.url() !== pageUrl) return finish('unknown', 'form_changed')
      const observed = await readState(false)
      if (!observed) return finish('unknown', 'form_changed')
      if (observed.suppressed) return finish('unknown', 'submit_handler_suppressed')
      const measuredFeedback = await observedFeedback()
      if (observed.feedback || measuredFeedback !== null) {
        const feedbackMs = measuredFeedback ?? Date.now() - startedAt
        await sleep(50)
        return refused() ? finish('unknown', 'submission_blocked') : finish('passed', 'client_feedback', feedbackMs)
      }
      if (observed.outside > baseline.outside || observed.text !== baseline.text) return finish('unknown', 'unscoped_feedback')
      await sleep(50)
    }
    const lateRead = await observedFeedback()
    if (lateRead !== null && !refused()) return finish('passed', 'client_feedback', lateRead)
    return finish(observationBudget === 2000 ? 'failed' : 'unknown', observationBudget === 2000 ? 'missing_feedback' : 'observation_incomplete')
  } catch {
    const overlay = await detectOverlayAtPoint(page, submitSelector).catch(() => null)
    return finish('unknown', 'execution_interrupted', null, overlay)
  } finally {
    if (timing) { await timing.evaluate(tracker => tracker.dispose()).catch(() => undefined); await timing.dispose().catch(() => undefined) }
    if (!page.isClosed()) await page.evaluate(sel => document.querySelector(sel)?.removeAttribute('data-fixflags-local-validation'), selector).catch(() => undefined)
  }
}
