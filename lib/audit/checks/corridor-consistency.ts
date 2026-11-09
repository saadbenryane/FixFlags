import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'
import { createHash } from 'node:crypto'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import type { CheckAssertion } from './assertion'
import { CORRIDOR_VERIFICATION_RULE, PUBLIC_CORRIDOR_VERIFICATION_RULE } from './corridor-contract'

export { CORRIDOR_VERIFICATION_RULE } from './corridor-contract'
export const CORRIDOR_CONTEXT = /^corridor:[a-f0-9]{64}$/

const DESCRIPTORS = [
  {
    id: 'corridor-og-title-drift',
    rubric: 'REACH' as const,
    severity: 'IMPORTANT' as const,
    impactTag: 'SHARING' as const,
  },
  {
    id: 'corridor-og-description-drift',
    rubric: 'REACH' as const,
    severity: 'POLISH' as const,
    impactTag: 'SHARING' as const,
  },
]

for (const d of DESCRIPTORS) {
  registerCheck({
    id: d.id,
    rubric: d.rubric,
    impactTag: d.impactTag,
    severity: d.severity,
    tags: ['corridor', 'og'],
    requiresBrowser: false,
  })
}

export interface CorridorPageMeta {
  url: string
  role: string
  ogTitle: string | null
  ogDescription: string | null
  title: string | null
  scope?: CaptureObservationScope
  source?: 'native-head-v1' | 'public-head-v1'
  titleComplete?: boolean
  descriptionComplete?: boolean
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Cross-page OG consistency across reviewed pages.
 * Compares secondary pages against the pasted page share preview.
 */
export function runCorridorConsistencyChecks(pages: CorridorPageMeta[]): DeterministicFlag[] {
  return evaluateCorridorConsistency(pages).flags
}

/** Comparisons retain both source pages, even when their findings are collapsed. */
export function evaluateCorridorConsistency(pages: CorridorPageMeta[], source: 'http' | 'rendered-dom' = 'rendered-dom') {
  const assertions = new Map<string, CheckAssertion[]>()
  if (pages.length < 2) return { flags: [] as DeterministicFlag[], assertions }
  const anchor = pages.find((p) => p.role === 'primary') ?? pages[0]
  const ordered = [anchor, ...pages.filter(page => page.url !== anchor.url)]
  const flags: DeterministicFlag[] = []

  // Record every pair so a diagnostic run can start at an affected page without
  // losing its original comparison against the Site entry page.
  for (const [primary, page] of ordered.flatMap((first, index) => ordered.slice(index + 1).map(other => [first, other] as const))) {
    if (page.url === primary.url) continue
    const primaryTitle = normalizeText(primary.ogTitle)
    const primaryDesc = normalizeText(primary.ogDescription)
    const pageTitle = normalizeText(page.ogTitle)
    const pageDesc = normalizeText(page.ogDescription)
    const pair = [primary, page].map(item => ({ url: item.url, key: item.scope ? captureObservationKey(item.scope) : 'unknown',
      ...(item.source ? { source: item.source } : {}) }))
      .sort((left, right) => left.url.localeCompare(right.url))
    const scoped = pair.every(item => item.key !== 'unknown')
    const samePublicPage = source === 'http' && scoped && primary.scope?.finalUrl === page.scope?.finalUrl
    const hasTitles = Boolean(primaryTitle && pageTitle), hasDescriptions = Boolean(primaryDesc && pageDesc)
    const titlesObserved = primary.titleComplete !== false && page.titleComplete !== false
    const descriptionsObserved = primary.descriptionComplete !== false && page.descriptionComplete !== false
    const titleAbsence = scoped && titlesObserved ? 'not declared' : 'unavailable'
    const descriptionAbsence = scoped && descriptionsObserved ? 'not declared' : 'unavailable'
    const context = 'corridor:' + (scoped ? createHash('sha256').update(JSON.stringify(pair)).digest('hex') : 'unknown')
    const recorded: CheckAssertion[] = [
      { key: 'preview-titles', name: 'Distinct page preview titles', expected: 'The compared pages have distinct non-empty preview titles',
        observed: samePublicPage ? 'Both URLs returned the same public page.' : `${primary.url}: ${primary.ogTitle?.trim() || titleAbsence}; ${page.url}: ${page.ogTitle?.trim() || titleAbsence}`.slice(0, 2000),
        passed: !samePublicPage && titlesObserved && hasTitles && primaryTitle !== pageTitle, complete: scoped && titlesObserved, context,
        ...(samePublicPage || scoped && titlesObserved && !hasTitles ? { disposition: 'observed' as const } : {}) },
      { key: 'preview-descriptions', name: 'Page-specific preview descriptions', expected: 'The compared pages do not reuse the same long preview description',
        observed: samePublicPage ? 'Both URLs returned the same public page.' : `${primary.url}: ${primary.ogDescription || descriptionAbsence}; ${page.url}: ${page.ogDescription || descriptionAbsence}`.slice(0, 2000),
        passed: !samePublicPage && descriptionsObserved && hasDescriptions && (primaryDesc !== pageDesc || primaryDesc.length <= 20),
        complete: scoped && descriptionsObserved, context,
        ...(samePublicPage || scoped && descriptionsObserved && !hasDescriptions ? { disposition: 'observed' as const } : {}) },
    ]
    assertions.set(page.url, [...assertions.get(page.url) ?? [], ...recorded])
    if (primary !== anchor || samePublicPage) continue
    const evidence = { verificationRule: source === 'http' ? PUBLIC_CORRIDOR_VERIFICATION_RULE : CORRIDOR_VERIFICATION_RULE, affectedPaths: [page.url, primary.url],
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: 'Compared page previews', context }] }

    if (titlesObserved && primaryTitle && pageTitle && primaryTitle === pageTitle) {
      flags.push({
        checkId: 'corridor-og-title-drift',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        impactTag: 'SHARING',
        problem: 'Compared pages share a link preview title',
        evidence: `${primary.url} and ${page.url} both declare “${primary.ogTitle}”.`,
        fix: 'Give each page an og:title that identifies its own content. Publish the titles in the HTML head of both pages.',
        confidence: 0.9,
        source: 'DETERMINISTIC',
        pageUrl: page.url,
        ...evidence,
      })
    }

    if (descriptionsObserved && primaryDesc && pageDesc && primaryDesc === pageDesc && primaryDesc.length > 20) {
      flags.push({
        checkId: 'corridor-og-description-drift',
        rubric: 'REACH',
        severity: 'POLISH',
        impactTag: 'SHARING',
        problem: 'Compared pages share a link preview description',
        evidence: `${primary.url} and ${page.url} declare the same description.`,
        fix: 'Write an og:description for each page that explains what someone will find there. Publish each description in its HTML head.',
        confidence: 0.85,
        source: 'DETERMINISTIC',
        pageUrl: page.url,
        ...evidence,
      })
    }
  }

  return { flags, assertions }
}
