import type { Page } from 'playwright'
import { primaryControlContext, primaryPageContext } from './primary-action-evidence'
import { auditPageObservation } from '../browser/observation-scope'
import {
  FLOW_IDX_ATTR,
  rankScoredCtaCandidate,
  scoreCtaCandidates,
  type ScoredCtaCandidate,
} from './score-cta-candidates'

export interface FlowCtaCandidate {
  flowIdx: number
  text: string
  href: string | null
  score: number
  opensInNewTab: boolean
  context?: string
  controls?: string | null
  fragmentRoute?: boolean
}

const CTA_SELECTORS = 'a[href], a.btn, a[class*="cta"], button, input[type="button"], input[type="submit"], [role="button"]'

export function flowCtaSelector(flowIdx: number): string {
  return `[${FLOW_IDX_ATTR}="${flowIdx}"]`
}

/** Shared rendered inventory. Disabled controls remain available for failure diagnosis. */
export async function collectRenderedActionInventory(page: Page, includeNavigation = false, viewportOnly = true) {
  return page.evaluate(
    ({ selectors, attr, includeNavigation, viewportOnly }: { selectors: string; attr: string; includeNavigation: boolean; viewportOnly: boolean }) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const marked = document.querySelectorAll(`[${attr}]`)
      if (marked.length > 2000) return { controls: [], complete: false, viewportComplete: false, pageUrl: location.href }
      marked.forEach((el) => el.removeAttribute(attr))

      const elements = document.querySelectorAll(selectors)
      let complete = elements.length <= 2000 && Boolean(document.body), labelNodes = 0
      let viewportComplete = complete
      const styles = new Map<Element, CSSStyleDeclaration>(), paint = new Map<Element, boolean>()
      const siblingPositions = new Map<Element, Map<Element, number>>(), uniqueIds = new Map<string, boolean>()
      const siblingPosition = (element: Element) => {
        const parent = element.parentElement
        if (!parent) return 1
        let positions = siblingPositions.get(parent)
        if (!positions) {
          positions = new Map<Element, number>()
          const counts = new Map<string, number>()
          for (const child of parent.children) {
            const position = (counts.get(child.tagName) ?? 0) + 1
            counts.set(child.tagName, position); positions.set(child, position)
          }
          siblingPositions.set(parent, positions)
        }
        return positions.get(element) ?? 1
      }
      const styleOf = (element: Element) => {
        let style = styles.get(element)
        if (!style) { style = getComputedStyle(element); styles.set(element, style) }
        return style
      }
      const painted = (element: Element) => {
        const pending: Element[] = []
        let visible = true
        for (let node: Element | null = element; node; node = node.parentElement) {
          const cached = paint.get(node)
          if (cached !== undefined) { visible = cached; break }
          const style = styleOf(node)
          pending.push(node)
          if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) { visible = false; break }
        }
        for (const node of pending) paint.set(node, visible)
        return visible
      }
      const range = document.createRange()
      const referenceHidden = new Map<Element, boolean>()
      const hiddenFromName = (element: Element) => {
        const pending: Element[] = []
        let hidden = false
        for (let node: Element | null = element; node; node = node.parentElement) {
          const cached = referenceHidden.get(node)
          if (cached !== undefined) { hidden = cached; break }
          pending.push(node)
          const style = styleOf(node)
          if (node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.contentVisibility === 'hidden') { hidden = true; break }
        }
        for (const node of pending) referenceHidden.set(node, hidden)
        return hidden || styleOf(element).visibility !== 'visible'
      }
      const referenceNames = new Map<Element, { text: string; complete: boolean }>()
      const referenceText = (element: Element) => {
        const cached = referenceNames.get(element)
        if (cached) return cached
        let text = '', complete = true
        if (element.matches('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) complete = false
        else if (element.getAttribute('aria-label')?.trim()) text = element.getAttribute('aria-label')!
        else {
          const includeHidden = hiddenFromName(element)
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
          let node: Node | null
          while ((node = walker.nextNode())) {
            if (++labelNodes > 20_000) { complete = false; break }
            const parent = node.parentElement
            if (!parent || parent.closest('script,style,noscript,template')) continue
            if (!includeHidden && hiddenFromName(parent)) continue
            if (parent.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) { complete = false; continue }
            const raw = node.textContent ?? ''
            if (text.length + raw.length > 1000) { complete = false; break }
            text += raw
          }
        }
        if (text.length > 1000) complete = false
        const result = { text: text.slice(0, 1000).replace(/\s+/g, ' ').trim(), complete }
        referenceNames.set(element, result)
        return result
      }
      const labelFor = (element: Element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node: Node | null, text = element instanceof HTMLInputElement && ['button', 'submit'].includes(element.type) ? element.value : '', previous: DOMRect | undefined, labelComplete = true
        while ((node = walker.nextNode())) {
          if (++labelNodes > 20_000) { labelComplete = false; break }
          const parent = node.parentElement, raw = node.textContent ?? ''
          if (!parent || parent.closest('script,style,noscript,template') || styleOf(parent).visibility !== 'visible' || !painted(parent)) continue
          if (raw.length > 1000 || text.length + raw.length > 1000) { labelComplete = false; break }
          if (!raw.trim()) continue
          range.selectNodeContents(node)
          const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0)
          if (!rects.length) continue
          const first = rects[0]
          if (previous && (Math.abs(first.top - previous.top) > 1 || first.left > previous.right + 0.5)) text += ' '
          text += raw; previous = rects[rects.length - 1]
        }
        const boundedLabel = (raw: string) => {
          if (raw.length > 1000) labelComplete = false
          return raw.slice(0, 1000).trim()
        }
        text = boundedLabel(text)
        if (!text) {
          const references = element.getAttribute('aria-labelledby')?.trim() ?? ''
          const ids = [...new Set(references.split(/\s+/).filter(Boolean))]
          const names: string[] = []
          if (references.length > 1000 || ids.length > 50) labelComplete = false
          else for (const id of ids) {
            // Explicit references may name a control with hidden label text.
            // First-ID browser lookup does not borrow a later duplicate label.
            const label = document.getElementById(id)
            if (!label) continue
            const name = referenceText(label)
            labelComplete &&= name.complete
            names.push(name.text)
          }
          text = boundedLabel(names.join(' ')) || boundedLabel(element.getAttribute('aria-label') ?? '') || boundedLabel(element.getAttribute('title') ?? '')
        }
        text = text.replace(/\s+/g, ' ')
        if (!labelComplete) complete = false
        return { text: text.slice(0, 1000), labelComplete }
      }
      const items: Array<{
        idx: number
        tag: string
        role: string | null
        inputType: string | null
        text: string
        href: string | null
        opensInNewTab: boolean
        hashTargetExists?: boolean
        identity: string
        controls: string | null
        resolvedHref: string | null
        enabled: boolean
        styledAction: boolean
        inNavigation: boolean
        primary: boolean
        width: number
        height: number
        inViewport: boolean
        labelComplete: boolean
      }> = []
      let idx = 0

      for (let candidate = 0; candidate < Math.min(elements.length, 2000); candidate++) {
        const el = elements[candidate]
        if (!includeNavigation && el.closest('nav, header, [role="navigation"]')) continue
        if (el.closest('[inert]') || styleOf(el).visibility !== 'visible' || !painted(el)) continue

        const rect = el.getBoundingClientRect()
        const inViewport =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        if (rect.width <= 0 || rect.height <= 0 || viewportOnly && !inViewport) continue

        const tag = el.tagName.toLowerCase()
        const href =
          tag === 'a'
            ? (el as HTMLAnchorElement).getAttribute('href')
            : el.closest('a')?.getAttribute('href') ?? null
        const { text, labelComplete } = labelFor(el)
        if (!labelComplete && inViewport) viewportComplete = false

        const anchor = tag === 'a' ? el : el.closest('a')
        const opensInNewTab = Boolean(anchor && (anchor.getAttribute('target') ?? document.querySelector('base[target]')?.getAttribute('target'))?.toLowerCase() === '_blank')

        let destination: URL | null = null
        try { if (href) destination = new URL(href, document.baseURI) } catch { /* Invalid destinations stay unverified. */ }
        const resolvedHref = destination?.href ?? null
        let hashTargetExists: boolean | undefined
        if (destination?.username || destination?.password) {
          complete = false
          if (inViewport) viewportComplete = false
          continue
        }
        el.setAttribute(attr, String(idx))
        if (destination?.hash && destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) {
          hashTargetExists = false
          try {
            const id = decodeURIComponent(destination.hash.slice(1))
            hashTargetExists = Boolean(id && (document.getElementById(id) || document.querySelector('a[name="' + CSS.escape(id) + '"]')))
          } catch { /* Invalid fragments cannot establish a destination. */ }
        }
        const path: string[] = []
        let node: Element | null = el
        while (node && path.length < 12) {
          if (node.id) {
            if (!uniqueIds.has(node.id)) uniqueIds.set(node.id, document.querySelectorAll('#' + CSS.escape(node.id)).length === 1)
            if (uniqueIds.get(node.id)) { path.unshift('#' + CSS.escape(node.id)); break }
          }
          path.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + siblingPosition(node) + ')')
          node = node.parentElement
        }
        items.push({ idx, tag, inputType: el instanceof HTMLInputElement ? el.type : null, role: el.getAttribute('role'), text, labelComplete, inViewport, href, opensInNewTab, identity: path.join('>'), controls: el.getAttribute('aria-controls'), resolvedHref,
          enabled: !el.matches(':disabled,[aria-disabled="true"]'), styledAction: el.matches('a.btn,a[class*="cta"]'),
          inNavigation: Boolean(el.closest('nav,header,[role="navigation"]')),
          primary: el.matches('.primary,[class*="cta"],[class*="btn-primary"],button:not([class*="ghost"])'), width: rect.width, height: rect.height,
          ...(hashTargetExists !== undefined ? { hashTargetExists } : {}) })
        idx++
      }

      return { controls: items, complete, viewportComplete, pageUrl: location.href }
    },
    { selectors: CTA_SELECTORS, attr: FLOW_IDX_ATTR, includeNavigation, viewportOnly }
  )
}

export async function discoverFlowCtas(page: Page, pageUrl: string, includeNavigation = false) {
  const inventory = await collectRenderedActionInventory(page, includeNavigation)
  const samePage = inventory.pageUrl === page.url()
  const raw = samePage ? inventory.controls.filter(control => control.labelComplete) : []
  const pageContext = primaryPageContext(pageUrl, page.url(), page.viewportSize(), auditPageObservation(page)?.scope)
  const byIndex = new Map(raw.map(item => [item.idx, item]))
  const candidates = scoreCtaCandidates(page.url(), raw).map((item) => {
    const element = byIndex.get(item.idx)!
    return { flowIdx: item.idx, text: item.text, href: item.href,
      score: item.score, opensInNewTab: element.opensInNewTab,
      context: primaryControlContext({ pageContext, identity: element.identity, label: item.text, href: element.resolvedHref, controls: element.controls }),
      controls: element.controls, ...(item.fragmentRoute ? { fragmentRoute: true } : {}) }
  })
  return { candidates, complete: inventory.complete && samePage }
}

/** If header/nav filtering removed all candidates, retry including them (auth still scores low). */
export async function discoverFlowCtasWithFallback(
  page: Page,
  pageUrl: string
) {
  const mainOnly = await discoverFlowCtas(page, pageUrl)
  return mainOnly.candidates.length ? mainOnly : discoverFlowCtas(page, pageUrl, true)
}

export function rankCtaCandidate(candidates: FlowCtaCandidate[]): FlowCtaCandidate | null {
  if (candidates.length === 0) return null
  const mapped: ScoredCtaCandidate[] = candidates.map((c) => ({
    idx: c.flowIdx,
    text: c.text,
    href: c.href,
    score: c.score,
  }))
  const top = rankScoredCtaCandidate(mapped)
  if (!top) return null
  return candidates.find((c) => c.flowIdx === top.idx) ?? null
}
