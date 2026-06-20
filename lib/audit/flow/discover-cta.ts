import type { Page } from 'puppeteer'
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
}

const CTA_SELECTORS = 'a[href], button, [role="button"]'

export function flowCtaSelector(flowIdx: number): string {
  return `[${FLOW_IDX_ATTR}="${flowIdx}"]`
}

export async function discoverFlowCtas(page: Page, pageUrl: string): Promise<FlowCtaCandidate[]> {
  const raw = await page.evaluate((selectors, attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))

    const elements = Array.from(document.querySelectorAll(selectors))
    const items: Array<{
      idx: number
      tag: string
      text: string
      href: string | null
      opensInNewTab: boolean
    }> = []
    let idx = 0

    for (const el of elements) {
      if (el.closest('nav, header, [role="navigation"]')) continue

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
      items.push({ idx, tag, text, href, opensInNewTab })
      idx++
    }

    return items
  }, CTA_SELECTORS, FLOW_IDX_ATTR)

  return scoreCtaCandidates(pageUrl, raw).map((item) => ({
    flowIdx: item.idx,
    text: item.text,
    href: item.href,
    score: item.score,
    opensInNewTab: raw.find((r) => r.idx === item.idx)?.opensInNewTab ?? false,
  }))
}

/** If header/nav filtering removed all candidates, retry including them (auth still scores low). */
export async function discoverFlowCtasWithFallback(
  page: Page,
  pageUrl: string
): Promise<FlowCtaCandidate[]> {
  const mainOnly = await discoverFlowCtas(page, pageUrl)
  if (mainOnly.length > 0) return mainOnly

  const raw = await page.evaluate((selectors, attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr))
    const elements = Array.from(document.querySelectorAll(selectors))
    const items: Array<{
      idx: number
      tag: string
      text: string
      href: string | null
      opensInNewTab: boolean
    }> = []
    let idx = 0
    for (const el of elements) {
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
      items.push({ idx, tag, text, href, opensInNewTab })
      idx++
    }
    return items
  }, CTA_SELECTORS, FLOW_IDX_ATTR)

  return scoreCtaCandidates(pageUrl, raw).map((item) => ({
    flowIdx: item.idx,
    text: item.text,
    href: item.href,
    score: item.score,
    opensInNewTab: raw.find((r) => r.idx === item.idx)?.opensInNewTab ?? false,
  }))
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
