import type { Page } from 'puppeteer'
import { isDeadHref, resolveSameOrigin, scoreCtaLink } from './link-scoring'

export interface FlowCtaCandidate {
  selector: string
  text: string
  href: string | null
  score: number
}

const CTA_SELECTORS = 'a[href], button, [role="button"]'

export async function discoverFlowCtas(page: Page, pageUrl: string): Promise<FlowCtaCandidate[]> {
  const origin = new URL(pageUrl).origin

  const raw = await page.evaluate((selectors) => {
    const elements = Array.from(document.querySelectorAll(selectors))
    return elements
      .map((el, index) => {
        const rect = el.getBoundingClientRect()
        const inViewport =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        if (!inViewport) return null

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

        return { index, tag, text, href }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, CTA_SELECTORS)

  const candidates: FlowCtaCandidate[] = []

  for (const item of raw) {
    const href = item.href ?? ''
    if (isDeadHref(href) && item.tag !== 'button') continue

    let score = scoreCtaLink(href, item.text)
    if (score === 0 && item.tag === 'button') {
      if (/get started|sign up|signup|start|try|demo|contact|register|join/i.test(item.text)) {
        score = 85
      } else {
        continue
      }
    }
    if (score === 0) continue

    const resolved = href ? resolveSameOrigin(origin, href) : null
    let selector: string
    if (item.tag === 'a' && href) {
      selector = `a[href="${href.replace(/"/g, '\\"')}"]`
    } else {
      selector = `${item.tag}:nth-of-type(${item.index + 1})`
    }

    candidates.push({
      selector,
      text: item.text,
      href: resolved ?? href ?? null,
      score: href && href.startsWith('http') && !resolved ? score - 10 : score,
    })
  }

  return candidates.sort((a, b) => b.score - a.score)
}

export function rankCtaCandidate(candidates: FlowCtaCandidate[]): FlowCtaCandidate | null {
  if (candidates.length === 0) return null
  return candidates[0]
}
