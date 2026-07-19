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
    return anchors.slice(0, 80).map((a) => {
      const el = a as HTMLAnchorElement
      return {
        href: el.getAttribute('href') ?? '',
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
    if (!resolved.startsWith(origin)) continue
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
    const h1 = document.querySelector('h1')
    if (!h1) return false
    const text = (h1.textContent ?? '').trim()
    return text.length >= 12
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
      const el = document.querySelector(sel)
      if (!el) continue
      const text = (el.textContent ?? '').trim()
      if (text.length >= 2) return { found: true, text: text.slice(0, 60) }
    }
    return { found: false, text: null }
  })
}

export async function countVisibleFormFields(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select')
    ).filter((el) => {
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden'
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
  // first-visit: prefer pricing then primary CTA then highest score
  return (
    links.find((l) => l.category === 'pricing') ??
    links.find((l) => l.category === 'primary-cta') ??
    links[0]
  )
}
