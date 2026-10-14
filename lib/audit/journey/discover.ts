import type { Page } from 'playwright'
import { scoreCtaLink, classifyLinkCategory } from '@/lib/audit/flow/link-scoring'
import type { JourneyType } from './types'

export interface JourneyLinkCandidate {
  href: string
  text: string
  score: number
  category: string
}

/** Discover interactive same-origin links for journey navigation. */
export async function discoverJourneyLinks(
  page: Page,
  origin: string
): Promise<JourneyLinkCandidate[]> {
  const raw = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'))
    return anchors.slice(0, 80).filter(a => {
      if (!a.getClientRects().length) return false
      for (let node: Element | null = a; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
      }
      return true
    }).map((a) => {
      const el = a as HTMLAnchorElement
      return {
        href: el.href,
        text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 80),
      }
    })
  })

  const out: JourneyLinkCandidate[] = []
  const seen = new Set<string>()
  for (const link of raw) {
    if (!link.href || link.href.startsWith('mailto:') || link.href.startsWith('tel:')) continue
    let resolved: string
    try {
      resolved = new URL(link.href, origin).toString()
    } catch {
      continue
    }
    if (new URL(resolved).origin !== origin) continue
    if (seen.has(resolved)) continue
    seen.add(resolved)
    const score = scoreCtaLink(resolved, link.text)
    if (score === 0) continue
    out.push({
      href: resolved,
      text: link.text,
      score,
      category: classifyLinkCategory(resolved, link.text),
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

export async function pageHasClearHeadline(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const headline = Array.from(document.querySelectorAll('h1')).find(h1 => {
      if (!h1.getClientRects().length) return false
      for (let node: Element | null = h1; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
      }
      return true
    })
    return Boolean(headline && (headline.textContent ?? '').trim().length >= 12)
  })
}

export async function pageHasPrimaryCta(page: Page): Promise<{ found: boolean; text: string | null }> {
  return page.evaluate(() => {
    const selectors = [
      'a[href*="signup"]',
      'a[href*="sign-up"]',
      'a[href*="pricing"]',
      'a[href*="demo"]',
      'button',
      '[role="button"]',
      'a.btn',
      'a[class*="cta"]',
    ]
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0 || rect.top >= innerHeight || rect.bottom <= 0 || rect.left >= innerWidth || rect.right <= 0 || el.matches(':disabled,[aria-disabled="true"]')) continue
        let visible = true
        for (let node: Element | null = el; node; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) { visible = false; break }
        }
        const text = (el.textContent || el.getAttribute('aria-label') || '').trim()
        if (visible && text.length >= 2) return { found: true, text: text.slice(0, 60) }
      }
    }
    return { found: false, text: null }
  })
}

export async function countVisibleFormFields(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select')
    ).filter((el) => {
      if (!el.getClientRects().length) return false
      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) === 0) return false
      }
      return true
    }).length
  })
}

export function pickTargetForJourney(
  type: JourneyType,
  links: JourneyLinkCandidate[]
): JourneyLinkCandidate | null {
  if (links.length === 0) return null
  if (type === 'pricing-evaluation') {
    return links.find((l) => l.category === 'pricing' || /pric|plan/i.test(l.href + l.text)) ?? links[0]
  }
  if (type === 'signup') {
    return (
      links.find((l) => l.category === 'primary-cta' || /sign.?up|register|trial|get.?started/i.test(l.href + l.text)) ??
      links[0]
    )
  }
  if (type === 'contact-support') {
    return (
      links.find((l) => /contact|support|help/i.test(l.href + l.text)) ??
      links.find((l) => l.category === 'resources') ??
      null
    )
  }
  if (type === 'multi-step-funnel') {
    return (
      links.find((l) => l.category === 'primary-cta' || /sign.?up|register|trial|get.?started|pricing|demo/i.test(l.href + l.text)) ??
      links.find((l) => l.category === 'pricing') ??
      links[0]
    )
  }
  // first-visit: prefer pricing then primary CTA then highest score
  return (
    links.find((l) => l.category === 'pricing') ??
    links.find((l) => l.category === 'primary-cta') ??
    links[0]
  )
}

/**
 * For multi-step funnel: pick the best next target given the steps already visited.
 * Avoids revisiting URLs and prefers progression toward conversion goals.
 */
export function pickNextFunnelTarget(
  links: JourneyLinkCandidate[],
  visitedUrls: Set<string>,
  goalKeywords: string[]
): JourneyLinkCandidate | null {
  const unvisited = links.filter((l) => !visitedUrls.has(l.href))
  if (unvisited.length === 0) return null

  const goalMatch = unvisited.find((l) =>
    goalKeywords.some((kw) => new RegExp(kw, 'i').test(l.href + ' ' + l.text))
  )
  if (goalMatch) return goalMatch

  return unvisited[0]
}

/**
 * Detect whether the current page has meaningful content beyond navigation.
 * Used to identify dead-end pages (e.g., 404s, blank pages, error pages).
 */
export async function pageHasSubstantiveContent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const body = document.body
    if (!body) return false
    const text = (body.innerText ?? '').trim()
    if (text.length < 50) return false
    const h1 = document.querySelector('h1')
    const h2 = document.querySelector('h2')
    const main = document.querySelector('main, [role="main"], .content, .container')
    return Boolean(h1 || h2 || main)
  })
}

/**
 * Detect whether the page shows a loading state that might indicate
 * the journey step is still in progress.
 */
export async function pageIsLoading(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const body = document.body
    if (!body) return false
    const text = (body.innerText ?? '').trim().toLowerCase()
    return (
      text.length < 20 &&
      (text.includes('loading') || text.includes('spinner') || text.includes('please wait'))
    )
  })
}
