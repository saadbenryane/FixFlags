import * as cheerio from 'cheerio'
import { isDeadHref, resolveSameOrigin, scoreCtaLink } from './link-scoring'

export interface RawCtaElement {
  idx: number
  tag: string
  text: string
  href: string | null
}

export interface ScoredCtaCandidate {
  idx: number
  text: string
  href: string | null
  score: number
}

const CTA_BUTTON_PATTERN =
  /get started|sign up|signup|start|try|demo|contact|register|join/i

/** Pure scoring for unit tests and discover-cta. */
export function scoreCtaCandidates(
  pageUrl: string,
  elements: RawCtaElement[]
): ScoredCtaCandidate[] {
  const origin = new URL(pageUrl).origin
  const candidates: ScoredCtaCandidate[] = []

  for (const item of elements) {
    const href = item.href ?? ''
    if (isDeadHref(href) && item.tag !== 'button') continue

    let score = scoreCtaLink(href, item.text)
    if (score === 0 && item.tag === 'button') {
      if (CTA_BUTTON_PATTERN.test(item.text)) {
        score = 85
      } else {
        continue
      }
    }
    if (score === 0) continue

    const resolved = href ? resolveSameOrigin(origin, href) : null
    candidates.push({
      idx: item.idx,
      text: item.text,
      href: resolved ?? href ?? null,
      score: href && href.startsWith('http') && !resolved ? score - 10 : score,
    })
  }

  return candidates.sort((a, b) => b.score - a.score)
}

export function rankScoredCtaCandidate(
  candidates: ScoredCtaCandidate[]
): ScoredCtaCandidate | null {
  if (candidates.length === 0) return null
  return candidates[0]
}

const FLOW_IDX_ATTR = 'data-fixflags-flow-idx'

/** Extract in-viewport CTA elements from static HTML (unit tests). */
export function extractCtaElementsFromHtml(html: string): RawCtaElement[] {
  const $ = cheerio.load(html)
  const elements: RawCtaElement[] = []
  let idx = 0

  $('a[href], button, [role="button"]').each((_, el) => {
    const tag = el.tagName.toLowerCase()
    const href = tag === 'a' ? $(el).attr('href') ?? null : $(el).closest('a').attr('href') ?? null
    const text =
      $(el).text().trim() ||
      $(el).attr('aria-label')?.trim() ||
      $(el).attr('title')?.trim() ||
      ''
    elements.push({ idx: idx++, tag, text, href })
  })

  return elements
}

export { FLOW_IDX_ATTR }
