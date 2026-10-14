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
}

const CTA_SELECTORS = 'a[href], button, [role="button"]'

export function flowCtaSelector(flowIdx: number): string {
  return `[${FLOW_IDX_ATTR}="${flowIdx}"]`
}

export async function discoverFlowCtas(page: Page, pageUrl: string, includeNavigation = false): Promise<FlowCtaCandidate[]> {
  const raw = await page.evaluate(
    ({ selectors, attr, includeNavigation }: { selectors: string; attr: string; includeNavigation: boolean }) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))

      const elements = Array.from(document.querySelectorAll(selectors))
      const items: Array<{
        idx: number
        tag: string
        role: string | null
        text: string
        href: string | null
        opensInNewTab: boolean
        hashTargetExists?: boolean
        identity: string
        controls: string | null
        resolvedHref: string | null
      }> = []
      let idx = 0

      for (const el of elements) {
        if (!includeNavigation && el.closest('nav, header, [role="navigation"]')) continue

        const rect = el.getBoundingClientRect()
        const inViewport =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        if (!inViewport) continue

        const tag = el.tagName.toLowerCase()
        const href =
          tag === 'a'
            ? (el as HTMLAnchorElement).getAttribute('href')
            : el.closest('a')?.getAttribute('href') ?? null
        const text =
          (el.textContent ?? '').trim() ||
          el.getAttribute('aria-label')?.trim() ||
          el.getAttribute('title')?.trim() ||
          ''

        const anchor = tag === 'a' ? el : el.closest('a')
        const opensInNewTab = anchor?.getAttribute('target') === '_blank'

        el.setAttribute(attr, String(idx))
        let hashTargetExists: boolean | undefined
        if (href?.startsWith('#')) {
          hashTargetExists = false
          try {
            const id = decodeURIComponent(href.slice(1))
            hashTargetExists = Boolean(id && (document.getElementById(id) || document.querySelector('a[name="' + CSS.escape(id) + '"]')))
          } catch { /* Invalid fragments cannot establish a destination. */ }
        }
        const path: string[] = []
        let node: Element | null = el
        while (node && path.length < 12) {
          if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) { path.unshift('#' + node.id); break }
          const siblings: Element[] = node.parentElement ? Array.from(node.parentElement.children).filter(child => child.tagName === node!.tagName) : []
          path.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')')
          node = node.parentElement
        }
        let resolvedHref: string | null = null
        try { if (href) resolvedHref = new URL(href, document.baseURI).href } catch { /* Invalid destinations stay unverified. */ }
        items.push({ idx, tag, role: el.getAttribute('role'), text, href, opensInNewTab, identity: path.join('>'), controls: el.getAttribute('aria-controls'), resolvedHref,
          ...(hashTargetExists !== undefined ? { hashTargetExists } : {}) })
        idx++
      }

      return items
    },
    { selectors: CTA_SELECTORS, attr: FLOW_IDX_ATTR, includeNavigation }
  )

  const pageContext = primaryPageContext(pageUrl, page.url(), page.viewportSize(), auditPageObservation(page)?.scope)
  const byIndex = new Map(raw.map(item => [item.idx, item]))
  return scoreCtaCandidates(pageUrl, raw).map((item) => {
    const element = byIndex.get(item.idx)!
    return { flowIdx: item.idx, text: item.text, href: element.href?.startsWith('#') ? item.href : element.resolvedHref ?? item.href,
      score: item.score, opensInNewTab: element.opensInNewTab,
      context: primaryControlContext({ pageContext, identity: element.identity, label: item.text, href: element.resolvedHref, controls: element.controls }),
      controls: element.controls }
  })
}

/** If header/nav filtering removed all candidates, retry including them (auth still scores low). */
export async function discoverFlowCtasWithFallback(
  page: Page,
  pageUrl: string
): Promise<FlowCtaCandidate[]> {
  const mainOnly = await discoverFlowCtas(page, pageUrl)
  return mainOnly.length ? mainOnly : discoverFlowCtas(page, pageUrl, true)
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
