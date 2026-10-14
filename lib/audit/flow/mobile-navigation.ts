import type { Page } from 'playwright'
import { auditPageObservation, captureObservationKey } from '../browser/observation-scope'
import { observeViewport } from '../browser/viewport-observation'
import { isBotInterstitialPage } from '../browser/page-capture'
import { readOnlyInteraction } from '../browser/read-only-interaction'
import { mobileLinkIdentity, mobileNavigationContext, type MobileNavigationObservation } from './mobile-navigation-evidence'

const OPEN_WINDOW_MS = 1500
const NAVIGATION_LIMIT = 4

/** Read declared navigation panels, including portals outside the header. */
function readNavigation(input: { selectors?: string[] }) {
  ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
  function path(element: Element) {
    if (element.id && document.querySelectorAll('#' + CSS.escape(element.id)).length === 1) return '#' + CSS.escape(element.id)
    const parts: string[] = []
    for (let node: Element | null = element; node && parts.length < 8; node = node.parentElement) {
      const siblings = node.parentElement ? [...node.parentElement.children].filter(child => child.tagName === node!.tagName) : [node]
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
      if (node.tagName === 'BODY') break
    }
    return parts.join(' > ')
  }
  function visible(element: Element) {
    const rect = element.getBoundingClientRect()
    if (!element.isConnected || rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.left >= innerWidth || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false
    for (let node: Element | null = element; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
    }
    return true
  }
  const name = (element: Element) => (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || element.tagName)
    .replace(/\s+/g, ' ').trim().slice(0, 160)
  const buttons = [...document.querySelectorAll('header button,header [role="button"],header summary,button[aria-controls],[role="button"][aria-controls]')]
    .filter(element => visible(element) && (!element.closest('form') || element.matches('button[type="button"],[role="button"]')))
  const declaresNavigation = (element: Element, panel?: Element) => /menu|navigation|hamburger/i.test(name(element)) || element.getAttribute('aria-haspopup') === 'menu' ||
    Boolean(panel?.matches('nav,[role="navigation"],[role="menu"]'))
  const declaredPanels = buttons.flatMap(element => (element.getAttribute('aria-controls') ?? '').split(/\s+/).slice(0, 4)
    .flatMap(id => { const panel = id && document.getElementById(id); return panel && declaresNavigation(element, panel) ? [panel] : [] }))
  const missingPanels = buttons.filter(button => declaresNavigation(button)).flatMap(button => (button.getAttribute('aria-controls') ?? '').split(/\s+/).slice(0, 4)
    .flatMap(id => {
      const selector = '#' + CSS.escape(id)
      return id && !document.getElementById(id) && (!input.selectors || input.selectors.includes(selector)) ? [{ selector,
        label: 'Declared mobile navigation', bounded: selector.length <= 2000,
        toggle: { selector: path(button), declared: true, expanded: false, disabled: button.matches(':disabled,[aria-disabled="true"]') },
        links: [] as Array<{ href: string; label: string; selector: string; reachable: boolean }> }] : []
    }))
  const virtualPanels = [...new Map(missingPanels.map(panel => [panel.selector, panel])).values()]
  const selected = input.selectors ? input.selectors.flatMap(selector => {
    try { const panel = document.querySelector(selector); return panel ? [panel] : [] } catch { return [] }
  }) : [...new Set([...document.querySelectorAll('header nav,header [role="navigation"],nav[aria-label],[role="navigation"]'), ...declaredPanels])]
    .filter(element => !element.closest('footer') && !/pagination|breadcrumb/i.test(element.getAttribute('aria-label') ?? ''))
    .filter((element, _, all) => !all.some(parent => parent !== element && parent.contains(element)))
  const panels = selected.slice(0, 4).map(panel => {
    const anchors = [...panel.querySelectorAll<HTMLAnchorElement>('a[href]')]
    const panelSelector = path(panel)
    const declared = buttons.find(button => (panel.id && (button.getAttribute('aria-controls') ?? '').split(/\s+/).includes(panel.id)) ||
      button.tagName === 'SUMMARY' && button.closest('details')?.contains(panel))
    const toggle = declared ?? buttons.find(button => /menu|navigation|hamburger/i.test(name(button)))
    return { selector: panelSelector, label: (panel.getAttribute('aria-label') || 'Mobile navigation').slice(0, 160),
      bounded: anchors.length <= 40 && panelSelector.length <= 2000 && !panel.querySelector('iframe,frame') &&
        ![panel, ...panel.querySelectorAll('*')].some(element => element.shadowRoot),
      toggle: toggle ? { selector: path(toggle), declared: Boolean(declared), expanded: toggle.getAttribute('aria-expanded') === 'true' ||
        toggle.tagName === 'SUMMARY' && Boolean(toggle.closest('details')?.open), disabled: toggle.matches(':disabled,[aria-disabled="true"]') } : null,
      links: anchors.slice(0, 40).map(anchor => ({ href: anchor.href, label: name(anchor) || 'Navigation link', selector: path(anchor), reachable: visible(anchor) })) }
  })
  const potentialNavigation = buttons.some(button => declaresNavigation(button))
  return { pageUrl: location.href, ready: document.readyState !== 'loading',
    touch: navigator.maxTouchPoints > 0,
    complete: selected.length + virtualPanels.length <= 4 && (selected.length + virtualPanels.length > 0 || !potentialNavigation),
    potentialNavigation, panels: [...panels, ...virtualPanels].slice(0, 4) }
}

/** Observe local menu opening only. Links are never followed. */
export async function collectMobileNavigation(page: Page, deadline: number, options: { selectors?: string[]; refusalCount?: () => number } = {}) {
  const source = auditPageObservation(page), pageUrl = page.url()
  const observations: MobileNavigationObservation[] = []
  const boundary = await readOnlyInteraction(page, pageUrl)
  const priorRefusals = options.refusalCount?.() ?? 0
  let complete = true
  try {
    const [initial, viewport, title] = await Promise.all([
      page.evaluate(readNavigation, { selectors: options.selectors }),
      observeViewport(page, { profile: 'mobile-navigation', includeActions: false, excludeLoading: true }), page.title(),
    ])
    const activate = (selector: string, timeout: number) => initial.touch
      ? page.locator(selector).tap({ timeout }) : page.locator(selector).click({ timeout })
    const available = Boolean(source && captureObservationKey(source.scope) !== 'unknown' && !source.restricted && viewport.content && viewport.pageUrl === pageUrl &&
      page.viewportSize()?.width === 375 && initial.ready && initial.pageUrl === pageUrl && !isBotInterstitialPage({ title }))
    complete = initial.complete && (!options.selectors || options.selectors.length > 0 && initial.panels.length === new Set(options.selectors).size) &&
      (available || initial.panels.length === 0 && !options.selectors)
    for (const original of initial.panels.slice(0, NAVIGATION_LIMIT)) {
      if (!source || Date.now() >= deadline) { complete = false; break }
      if (original.selector.length > 2000) { complete = false; continue }
      const visibleBefore = original.links.filter(link => link.reachable).length
      let current = original, opened = false, observed = true, reason = 'navigation_observed'
      if (!original.bounded || !available) { observed = false; reason = 'navigation_evidence_unavailable' }
      else if (!original.toggle) {
        opened = visibleBefore > 0 && visibleBefore < 5
        reason = opened ? 'compact_navigation_visible' : 'mobile_menu_control_missing'
      } else if (original.toggle.expanded && original.links.length > 0 && visibleBefore === original.links.length) {
        opened = true; reason = 'declared_navigation_already_open'
      } else if (original.toggle.disabled) reason = 'mobile_menu_control_disabled'
      else {
        let clicked = false
        try {
          await activate(original.toggle.selector, Math.max(1, Math.min(1000, deadline - Date.now())))
          clicked = true
        } catch { reason = 'menu_activation_unavailable'; observed = false }
        if (clicked) {
          const until = Math.min(deadline, Date.now() + OPEN_WINDOW_MS)
          do {
            const frame = await page.evaluate(readNavigation, { selectors: [original.selector] })
            const panel = frame.panels[0]
            if (!panel || frame.pageUrl !== pageUrl) { observed = false; reason = 'original_navigation_missing'; break }
            current = panel
            opened = current.links.length > 0 && current.links.every(link => link.reachable) &&
              (original.toggle.declared ? current.toggle?.expanded === true || visibleBefore < current.links.length : true)
            if (opened) break
            if (Date.now() >= until) break
            await page.waitForTimeout(Math.min(75, until - Date.now()))
          } while (Date.now() < until)
          if (!opened && !original.toggle.declared) { observed = false; reason = 'undeclared_navigation_scope' }
          else if (observed) reason = opened ? 'original_navigation_links_visible' : 'declared_menu_did_not_reveal_links_within_1500ms'
        }
      }
      const stable = auditPageObservation(page)?.scope.finalUrl === source.scope.finalUrl && page.url() === pageUrl &&
        !auditPageObservation(page)?.restricted && boundary.refusals() === 0 && (options.refusalCount?.() ?? 0) === priorRefusals
      const links = current.links.filter(link => link.selector.length <= 2000).map(link => ({ selector: link.selector, label: link.label,
        reachable: link.reachable, identity: mobileLinkIdentity(link.href, link.label) }))
      observations.push({ context: mobileNavigationContext(source.scope, original.selector), selector: original.selector, label: original.label,
        complete: observed && stable && current.bounded && links.length === current.links.length, opened, reason: stable ? reason : 'scanner_boundary_or_page_change', links })
      // Avoid altering a later menu through an earlier open drawer or overlay.
      if (current.toggle && !original.toggle?.expanded && opened) {
        try { await activate(current.toggle.selector, Math.max(1, Math.min(500, deadline - Date.now()))) }
        catch { complete = false; break }
      }
    }
    return { observations, complete: complete && observations.every(item => item.complete),
      applicable: initial.panels.length > 0 || initial.potentialNavigation || options.selectors !== undefined }
  } finally { await boundary.dispose() }
}
