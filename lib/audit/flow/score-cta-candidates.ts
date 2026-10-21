import * as cheerio from 'cheerio'
import { classifyCtaHref, isNonPageActionHref, resolveSameOrigin, scoreCtaLink } from './link-scoring'
import { isRoutingFragment } from './flow-url'

export interface RawCtaElement {
  idx: number
  tag: string
  inputType?: string | null
  role?: string | null
  text: string
  href: string | null
  resolvedHref?: string | null
  hashTargetExists?: boolean
}

export interface ScoredCtaCandidate {
  idx: number
  text: string
  href: string | null
  score: number
  fragmentRoute?: boolean
}

const CTA_BUTTON_PATTERN =
  /get started|sign up|signup|start|try|demo|contact|register|join|learn more|explore|shop|browse|watch|find|claim|reserve|see how|get access/i

/** Pure scoring for unit tests and discover-cta. */
export function scoreCtaCandidates(
  pageUrl: string,
  elements: RawCtaElement[]
): ScoredCtaCandidate[] {
  const current = new URL(pageUrl), origin = current.origin
  const candidates: ScoredCtaCandidate[] = []

  for (const item of elements) {
    const href = item.resolvedHref ?? item.href ?? ''
    let fragment = ''
    try {
      const target = new URL(href, pageUrl)
      if (target.username || target.password) continue
      if (current.origin === target.origin && current.pathname === target.pathname && current.search === target.search) {
        fragment = target.hash
      }
    } catch { /* Invalid declarations cannot supply a fragment destination. */ }
    const fragmentRoute = Boolean(fragment && isRoutingFragment(fragment) && !item.hashTargetExists)
    const buttonLike = item.tag === 'button' || item.tag === 'input' && ['button', 'submit'].includes(item.inputType ?? '') || item.role?.toLowerCase() === 'button'
    // mailto:/tel:/sms: links are intentional but never navigate the page, so
    // the flow scan must not select them as a page-navigation CTA candidate.
    const placeholder = classifyCtaHref(item.href ?? href, { baseUrl: pageUrl,
      resolvedHref: item.resolvedHref, hashTargetExists: item.hashTargetExists }).isPlaceholder
    if ((placeholder || isNonPageActionHref(href)) && !buttonLike) continue

    let score = scoreCtaLink(item.href ?? href, item.text)
    if (score === 0 && buttonLike) {
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
      href: fragment || resolved || href || null,
      score: href && href.startsWith('http') && !resolved ? score - 10 : score,
      ...(fragmentRoute ? { fragmentRoute: true } : {}),
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

  $('a[href], button, input[type="button"], input[type="submit"], [role="button"]').each((_, el) => {
    const $el = $(el)
    if ($el.closest('nav, header, [role="navigation"]').length > 0) return

    const tag = el.tagName.toLowerCase()
    const href = tag === 'a' ? $(el).attr('href') ?? null : $(el).closest('a').attr('href') ?? null
    const inputType = tag === 'input' ? ($el.attr('type') ?? '').toLowerCase() : null
    const text =
      (tag === 'input' && ['button', 'submit'].includes(inputType ?? '') ? $el.attr('value')?.trim() : '') ||
      $(el).text().trim() ||
      $(el).attr('aria-label')?.trim() ||
      $(el).attr('title')?.trim() ||
      ''
    let hashTargetExists: boolean | undefined
    if (href?.startsWith('#')) {
      hashTargetExists = false
      try {
        const id = decodeURIComponent(href.slice(1))
        hashTargetExists = Boolean(id && $('[id],a[name]').toArray().some(node => $(node).attr('id') === id || node.tagName === 'a' && $(node).attr('name') === id))
      } catch { /* Invalid fragments cannot establish a destination. */ }
    }
    elements.push({ idx: idx++, tag, inputType, role: $el.attr('role') ?? null, text, href, ...(hashTargetExists !== undefined ? { hashTargetExists } : {}) })
  })

  return elements
}

export { FLOW_IDX_ATTR }
