import { observeRenderedCopy } from '../browser/rendered-copy'
import type { Page } from 'playwright'
import { scoreCtaLink, classifyLinkCategory } from '@/lib/audit/flow/link-scoring'
import { collectRenderedActionInventory, flowCtaSelector } from '../flow/discover-cta'
import { classifyCtaHref } from '../flow/link-scoring'
import { rankScoredCtaCandidate, scoreCtaCandidates } from '../flow/score-cta-candidates'
import type { JourneyType } from './types'

export interface JourneyLinkCandidate {
  href: string
  text: string
  score: number
  category: string
  selector?: string
  opensInNewTab?: boolean
}

/** One rendered cohort supplies primary action, ranked routes and exact click targets. */
export async function observeJourneyControls(page: Page, origin: string) {
  const inventory = await collectRenderedActionInventory(page, true, false)
  const raw = inventory.pageUrl === page.url() ? inventory.controls.filter(control => control.enabled && control.labelComplete) : []
  const out: JourneyLinkCandidate[] = []
  for (const link of raw) {
    if (link.tag !== 'a' || !link.resolvedHref || !classifyCtaHref(link.href, {
      baseUrl: inventory.pageUrl, resolvedHref: link.resolvedHref, hashTargetExists: link.hashTargetExists,
    }).isPageNavigation) continue
    const resolved = link.resolvedHref, target = new URL(resolved)
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin) continue
    const score = scoreCtaLink(resolved, link.text)
    if (score === 0) continue
    out.push({
      href: resolved,
      text: link.text.slice(0, 80), selector: flowCtaSelector(link.idx), opensInNewTab: link.opensInNewTab,
      score,
      category: classifyLinkCategory(resolved, link.text),
    })
  }
  const seen = new Set<string>()
  const links = out.sort((a, b) => b.score - a.score).filter(link => {
    if (seen.has(link.href)) return false
    seen.add(link.href); return true
  }).slice(0, 80)
  const controls = raw.filter(control => control.inViewport && control.text.length >= 2)
  const primary = rankScoredCtaCandidate(scoreCtaCandidates(page.url(), controls).filter(control => control.score >= 70))
  const control = controls.find(control => control.idx === primary?.idx) ??
    controls.find(control => control.tag === 'button' || control.tag === 'input' && ['button', 'submit'].includes(control.inputType ?? '') || control.role === 'button' || control.styledAction)
  const complete = inventory.complete && inventory.pageUrl === page.url()
  const viewportComplete = inventory.viewportComplete && inventory.pageUrl === page.url()
  return { pageUrl: inventory.pageUrl, links, pathComplete: complete || links.length > 0,
    primaryAction: { found: Boolean(control), text: control?.text.slice(0, 60) ?? null, complete: viewportComplete || Boolean(control) } }
}
export type JourneyControlObservation = Awaited<ReturnType<typeof observeJourneyControls>>

export async function discoverJourneyLinks(page: Page, origin: string): Promise<JourneyLinkCandidate[]> {
  return (await observeJourneyControls(page, origin)).links
}

export async function pageHasClearHeadline(page: Page): Promise<boolean> {
  const copy = await observeRenderedCopy(page)
  return copy.complete && (copy.h1s[0]?.length ?? 0) >= 12
}

export async function pageHasPrimaryCta(page: Page) {
  return (await observeJourneyControls(page, new URL(page.url()).origin)).primaryAction
}

export async function countVisibleFormFields(page: Page): Promise<number> {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select')
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
