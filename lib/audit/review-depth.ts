import { classifyLinkCategory, scoreCtaLink } from '@/lib/audit/flow/link-scoring'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'
import {
  collectEligibleDestinations,
  canonicalizeDestination,
  reviewPathLabel,
  type EligibleLink,
} from '@/lib/audit/url-identity'
import { DEFAULT_OPEN_CHECK_CEILING } from '@/lib/audit/open-check'

export type ReviewDepth = 1 | 2 | 3

export type ImportanceBand =
  | 'primary-nav'
  | 'customer-cta'
  | 'conversion'
  | 'informational'
  | 'secondary'
  | 'legal-footer'

export type RankedDestination = EligibleLink & {
  band: ImportanceBand
  rank: number
  score: number
}

/** Internal safety ceiling. Do not advertise. */
export const INTERNAL_REVIEW_PAGE_CEILING = 24

export const IMPORTANCE_BAND_ORDER: Record<ImportanceBand, number> = {
  'primary-nav': 0,
  'customer-cta': 1,
  conversion: 2,
  informational: 3,
  secondary: 4,
  'legal-footer': 5,
}

const LEGAL_FOOTER_PATTERN =
  /\b(privacy|terms|legal|cookie|cookies|gdpr|imprint|disclaimer|acceptable use|copyright)\b/i
const CONVERSION_PATH = /pricing|plans?|checkout|buy|signup|sign-up|register|demo|trial|contact|book/i
const PRODUCT_PATH = /product|features?|solutions?|platform|pricing/i
const NAV_HINT = /home|features?|product|pricing|docs|blog|about|login|sign/i

export function asReviewDepth(value: unknown): ReviewDepth {
  if (value === 2 || value === 3) return value
  return 1
}

export function auditDeadlineMsForDepth(
  depth: ReviewDepth,
  baseMs = AUDIT_DEADLINE_MS
): number {
  if (depth <= 1) return baseMs
  return baseMs + (depth - 1) * 180_000
}

export function openCheckCeilingForDepth(depth: ReviewDepth): number {
  return depth >= 3
    ? Math.min(120, DEFAULT_OPEN_CHECK_CEILING + 40)
    : DEFAULT_OPEN_CHECK_CEILING
}

export function classifyImportanceBand(href: string, text: string): ImportanceBand {
  const combined = `${href} ${text}`
  if (LEGAL_FOOTER_PATTERN.test(combined)) return 'legal-footer'
  const category = classifyLinkCategory(href, text)
  const score = scoreCtaLink(href, text)
  if (category === 'primary-cta' || score >= 90) return 'customer-cta'
  if (category === 'pricing' || CONVERSION_PATH.test(combined)) return 'conversion'
  if (category === 'features' || PRODUCT_PATH.test(href)) return 'informational'
  if (NAV_HINT.test(combined) && score >= 40) return 'primary-nav'
  if (category === 'trust' || category === 'resources') return 'informational'
  if (category === 'secondary-cta') return 'customer-cta'
  return 'secondary'
}

export function rankDestinations(links: EligibleLink[]): RankedDestination[] {
  return links
    .map((link) => {
      const band = classifyImportanceBand(link.href, link.text)
      const score = scoreCtaLink(link.href, link.text)
      return {
        ...link,
        band,
        score,
        rank: IMPORTANCE_BAND_ORDER[band] * 1_000 - score,
      }
    })
    .sort((left, right) => {
      if (left.rank !== right.rank) return left.rank - right.rank
      return left.canonical.pathname.localeCompare(right.canonical.pathname)
    })
}

export type ReviewPlan = {
  depth: ReviewDepth
  reviewUrls: string[]
  openCheckUrls: string[]
  truncated: boolean
}

/**
 * Decide which unique destinations to fully review vs only open-check.
 * Importance order, not DOM order. Depth 1 reviews only the pasted page.
 */
export function planReviewTargets(input: {
  pastedUrl: string
  depth: ReviewDepth
  pastedLinks: Array<{ href: string; text: string }>
  linkedPageLinks?: Array<{ pageUrl: string; links: Array<{ href: string; text: string }> }>
  reviewCeiling?: number
}): ReviewPlan {
  const pasted = canonicalizeDestination(input.pastedUrl)
  const origin = pasted?.url ?? input.pastedUrl
  const reviewCeiling = input.reviewCeiling ?? INTERNAL_REVIEW_PAGE_CEILING
  const fromPasted = collectEligibleDestinations(origin, input.pastedLinks)
  const rankedFromPasted = rankDestinations(fromPasted)

  const reviewKeys = new Set<string>()
  const reviewUrls: string[] = []

  const addReview = (url: string) => {
    const canonical = canonicalizeDestination(url, origin)
    if (!canonical) return
    if (reviewKeys.has(canonical.key)) return
    if (reviewUrls.length >= reviewCeiling) return
    reviewKeys.add(canonical.key)
    reviewUrls.push(canonical.url)
  }

  addReview(origin)

  if (input.depth >= 2) {
    for (const destination of rankedFromPasted) addReview(destination.canonical.url)
  }

  if (input.depth >= 3) {
    const hop2: EligibleLink[] = []
    for (const page of input.linkedPageLinks ?? []) {
      hop2.push(...collectEligibleDestinations(origin, page.links))
    }
    for (const destination of rankDestinations(hop2)) addReview(destination.canonical.url)
  }

  const openCheckUrls = new Set<string>()
  for (const destination of rankedFromPasted) openCheckUrls.add(destination.canonical.url)

  if (input.depth >= 3) {
    for (const page of input.linkedPageLinks ?? []) {
      for (const destination of collectEligibleDestinations(origin, page.links)) {
        openCheckUrls.add(destination.canonical.url)
      }
    }
  }

  const uniqueEligibleReview = new Set<string>(reviewKeys)
  for (const destination of rankedFromPasted) {
    if (input.depth >= 2) uniqueEligibleReview.add(destination.canonical.key)
  }
  if (input.depth >= 3) {
    for (const page of input.linkedPageLinks ?? []) {
      for (const destination of collectEligibleDestinations(origin, page.links)) {
        uniqueEligibleReview.add(destination.canonical.key)
      }
    }
  }

  return {
    depth: input.depth,
    reviewUrls,
    openCheckUrls: [...openCheckUrls],
    truncated: uniqueEligibleReview.size > reviewUrls.length,
  }
}

export function progressReviewingDetail(url: string): string {
  const label = reviewPathLabel(url)
  return label === 'Home' ? 'Reviewing this page' : `Reviewing ${label}`
}

export type ReviewCoverage = {
  reviewedPageCount: number
  linkedPageCount: number
  openCheckCount: number
  partial: boolean
}

export function parseReviewCoverage(value: unknown): ReviewCoverage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const reviewedPageCount = Number(record.reviewedPageCount)
  const linkedPageCount = Number(record.linkedPageCount)
  const openCheckCount = Number(record.openCheckCount)
  if (!Number.isFinite(reviewedPageCount) || !Number.isFinite(openCheckCount)) return null
  return {
    reviewedPageCount,
    linkedPageCount: Number.isFinite(linkedPageCount)
      ? linkedPageCount
      : Math.max(0, reviewedPageCount - 1),
    openCheckCount,
    partial: Boolean(record.partial),
  }
}

export function buildReviewCoverage(input: {
  reviewedPageCount: number
  openCheckCount: number
  partial: boolean
}): ReviewCoverage {
  return {
    reviewedPageCount: input.reviewedPageCount,
    linkedPageCount: Math.max(0, input.reviewedPageCount - 1),
    openCheckCount: input.openCheckCount,
    partial: input.partial,
  }
}
