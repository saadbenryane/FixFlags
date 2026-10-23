import type { Browser, Page } from 'playwright'
import { createAuditPage } from './page-session'
import { profileForDevice } from './capture-profile'
import { captureAccessKey, captureProfileKey, capturePageKey } from './observation-scope'
import { documentEvidenceWithheld } from './document-evidence'
import { observeViewport } from './viewport-observation'
import { PageCaptureError } from './page-capture'
import { probeCoverAtPoint, OVERLAY_PERSIST_MS, severityForOverlayBlocker, type OverlayBlockerInfo } from './overlay-probe'
import { discoverFlowCtasWithFallback, flowCtaSelector, rankCtaCandidate } from '../flow/discover-cta'
import type { ScanAccessConfig } from '../scan-access'
import { overlayControlContext, type OverlayTarget, type OverlayObservation } from '../checks/overlay-evidence'

const MAX_CONTROLS = 12
export async function readOverlayControls(page: Page, ctaSelectors: string[], only?: string[], forceKind?: OverlayTarget['kind']) {
  return page.evaluate(({ ctaSelectors, only, forceKind }) => {
    ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= fn => fn
    const result: Array<{ kind: 'nav' | 'cta' | 'form'; selector: string; label: string; identity: string; receivesPointer: boolean }> = []
    const candidates = only ? only.flatMap(selector => [...document.querySelectorAll(selector)])
      : [...document.querySelectorAll('nav a[href],nav button,header a[href],header button,[role="navigation"] a[href],[role="navigation"] button,form input,form select,form textarea,form button,' + (ctaSelectors.join(',') || 'a[data-fixflags-no-cta]'))]
    let complete = candidates.length <= 1000
    for (const element of [...new Set(candidates)].slice(0, 1000)) {
      if (!(element instanceof HTMLElement)) { complete = false; continue }
      const rect = element.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2 || rect.top >= innerHeight || rect.bottom <= 0 || rect.left >= innerWidth || rect.right <= 0) continue
      let visible = true
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0 || ancestor.hasAttribute('inert')) { visible = false; break }
      }
      if (!visible || element.matches(':disabled,[aria-disabled="true"]')) continue
      const x = rect.left + rect.width / 2, y = rect.top + Math.min(rect.height / 2, 24)
      if (x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) continue
      let selector = ''
      if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) selector = '#' + CSS.escape(element.id)
      else {
        const path: string[] = []
        for (let node: Element | null = element; node && path.length < 30; node = node.parentElement) {
          const siblings = node.parentElement ? [...node.parentElement.children].filter(child => child.tagName === node!.tagName) : [node]
          path.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
          if (node.tagName === 'BODY') break
        }
        selector = path.join(' > ')
      }
      if (selector.length > 2000 || document.querySelectorAll(selector).length !== 1) { complete = false; continue }
      const labels = 'labels' in element ? Array.from((element as HTMLInputElement).labels ?? []).map(label => label.textContent ?? '').join(' ') : ''
      const caption = element instanceof HTMLInputElement && ['button', 'submit', 'reset'].includes(element.type) ? element.value : ''
      const label = (element.getAttribute('aria-label') || labels || caption || element.textContent || element.getAttribute('name') || element.tagName.toLowerCase()).trim().replace(/\s+/g, ' ').slice(0, 160)
      const identity = JSON.stringify([selector, element.tagName, label, element.getAttribute('type'), element.getAttribute('name'),
        element instanceof HTMLAnchorElement ? element.href : null, element.getAttribute('aria-controls'), element.closest('form')?.getAttribute('action') ?? null])
      const top = document.elementFromPoint(x, y), receivesPointer = top === element || Boolean(top && element.contains(top))
      const kinds: Array<'nav' | 'cta' | 'form'> = []
      if (element.closest('nav,header,[role="navigation"]')) kinds.push('nav')
      if (ctaSelectors.some(selector => element.matches(selector))) kinds.push('cta')
      if (element.closest('form')) kinds.push('form')
      for (const kind of forceKind ? [forceKind] : kinds) result.push({ kind, selector, label: label || element.tagName.toLowerCase(), identity, receivesPointer })
    }
    return { controls: result, complete, pageUrl: location.href, ready: document.readyState === 'complete' }
  }, { ctaSelectors, only, forceKind })
}
const signature = (blocker: OverlayBlockerInfo | null) => blocker ? JSON.stringify([blocker.tag, blocker.id, blocker.className, blocker.role, blocker.zIndex]) : null

/** Read-only hit tests preserve original controls without dismissing overlays or submitting forms. */
export async function collectOverlayObservation(browser: Browser, pageUrl: string, options: { device: 'desktop' | 'mobile'; deadline: number;
  scanAccess?: ScanAccessConfig | null; expectedTargets?: OverlayTarget[]; kinds?: OverlayTarget['kind'][] }): Promise<OverlayObservation> {
  const profile = profileForDevice(options.device)
  let page: Page | undefined
  const scope = { pageUrl, finalUrl: pageUrl, profile: captureProfileKey(profile), access: captureAccessKey(options.scanAccess, pageUrl) }
  const expected = (options.expectedTargets ?? []).filter(target => target.context.startsWith('overlay:' + capturePageKey(pageUrl) + ':'))
  const unknown = (): OverlayObservation => ({ version: 1, device: options.device, scope, complete: false, restricted: true, contentVisible: false,
    controls: expected.map(target => ({ ...target, disposition: 'unknown', reason: 'unavailable', blocker: null })) })
  try {
    const session = await createAuditPage(browser, pageUrl, { profile, deadline: options.deadline, journeySafe: true, scanAccess: options.scanAccess })
    page = session.page; scope.finalUrl = page.url()
    try {
      const discovered = await discoverFlowCtasWithFallback(page, pageUrl)
      const primary = rankCtaCandidate(discovered.candidates)
      const ctaSelectors = [...new Set([...(primary ? [flowCtaSelector(primary.flowIdx)] : []),
        ...expected.filter(target => target.kind === 'cta').map(target => target.selector)])]
      const first = await readOverlayControls(page, ctaSelectors)
      const rows = first.controls.filter(control => !options.kinds || options.kinds.includes(control.kind)).map(control => ({ ...control,
        context: overlayControlContext(scope, control.kind, control.identity) }))
      const eligible = expected.length ? rows.filter(control => expected.some(target => target.context === control.context)) : rows
      const selected = eligible.slice(0, MAX_CONTROLS)
      const before = await Promise.all(selected.map(control => probeCoverAtPoint(page!, control.selector, true)))
      if (Date.now() + OVERLAY_PERSIST_MS >= options.deadline) return unknown()
      await page.waitForTimeout(OVERLAY_PERSIST_MS)
      const last = await readOverlayControls(page, ctaSelectors, selected.map(control => control.selector))
      const content = await observeViewport(page, { profile: 'overlays', includeActions: false, excludeLoading: true })
      const after = await Promise.all(selected.map(control => probeCoverAtPoint(page!, control.selector, true)))
      const stable = first.pageUrl === scope.finalUrl && last.pageUrl === scope.finalUrl && content.pageUrl === scope.finalUrl && page.url() === scope.finalUrl && last.ready
      const controls: OverlayObservation['controls'] = selected.map((control, index) => {
        const current = last.controls.find(candidate => candidate.kind === control.kind && candidate.identity === control.identity)
        const blocker = after[index]
        let disposition: 'passed' | 'failed' | 'unknown' = 'unknown', reason: OverlayObservation['controls'][number]['reason'] = 'changed'
        if (stable && current && current.receivesPointer) { disposition = 'passed'; reason = 'clear' }
        else if (stable && current && blocker?.looksLikeConsentChrome) { disposition = 'passed'; reason = 'consent_chrome' }
        else if (stable && current && blocker && signature(before[index]) === signature(blocker)) {
          if (severityForOverlayBlocker(blocker)) { disposition = 'failed'; reason = 'persistent_overlay' }
          else { disposition = 'passed'; reason = 'small_cover' }
        } else if (current) reason = 'unclassified_cover'
        return { kind: control.kind, selector: control.selector, label: control.label, context: control.context, disposition, reason,
          blocker: blocker ? { ...blocker, persisted: disposition === 'failed' } : null }
      })
      for (const target of expected) if (!controls.some(control => control.context === target.context)) controls.push({ ...target, disposition: 'unknown', reason: 'unavailable', blocker: null })
      return { version: 1, device: options.device, scope, controls, restricted: documentEvidenceWithheld(session.safetyRestrictions), contentVisible: content.content,
        complete: (expected.length > 0 || discovered.complete) && first.complete && last.complete && eligible.length <= MAX_CONTROLS && stable }
    } finally { session.disposeNetwork() }
  } catch (error) { if (error instanceof PageCaptureError) return unknown(); throw error }
  finally { await page?.context().close().catch(() => undefined) }
}
