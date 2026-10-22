import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'
import { createHash } from 'node:crypto'
import { captureObservationKey, type CaptureObservationScope } from '../browser/observation-scope'
import type { CheckAssertion } from './assertion'

export const CORRIDOR_VERIFICATION_RULE = 'Cross-page preview comparison: repeat every original page pair under the same browser and access conditions.'
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
  source?: 'native-head-v1'
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
export function evaluateCorridorConsistency(pages: CorridorPageMeta[]) {
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
    const hasTitles = Boolean(primaryTitle && pageTitle), hasDescriptions = Boolean(primaryDesc && pageDesc)
    const titlesObserved = primary.titleComplete !== false && page.titleComplete !== false
    const descriptionsObserved = primary.descriptionComplete !== false && page.descriptionComplete !== false
    const titleAbsence = scoped && titlesObserved ? 'not declared' : 'unavailable'
    const descriptionAbsence = scoped && descriptionsObserved ? 'not declared' : 'unavailable'
    const context = 'corridor:' + (scoped ? createHash('sha256').update(JSON.stringify(pair)).digest('hex') : 'unknown')
    const recorded: CheckAssertion[] = [
      { key: 'preview-titles', name: 'Distinct page preview titles', expected: 'The compared pages have distinct non-empty preview titles',
        observed: `${primary.url}: ${primary.ogTitle?.trim() || titleAbsence}; ${page.url}: ${page.ogTitle?.trim() || titleAbsence}`.slice(0, 2000),
        passed: titlesObserved && hasTitles && primaryTitle !== pageTitle, complete: scoped && titlesObserved, context,
        ...(scoped && titlesObserved && !hasTitles ? { disposition: 'observed' as const } : {}) },
      { key: 'preview-descriptions', name: 'Page-specific preview descriptions', expected: 'The compared pages do not reuse the same long preview description',
        observed: `${primary.url}: ${primary.ogDescription || descriptionAbsence}; ${page.url}: ${page.ogDescription || descriptionAbsence}`.slice(0, 2000),
        passed: descriptionsObserved && hasDescriptions && (primaryDesc !== pageDesc || primaryDesc.length <= 20),
        complete: scoped && descriptionsObserved, context, ...(scoped && descriptionsObserved && !hasDescriptions ? { disposition: 'observed' as const } : {}) },
    ]
    assertions.set(page.url, [...assertions.get(page.url) ?? [], ...recorded])
    if (primary !== anchor) continue
    const evidence = { verificationRule: CORRIDOR_VERIFICATION_RULE, affectedPaths: [page.url, primary.url],
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: 'Compared page previews', context }] }

    if (titlesObserved && primaryTitle && pageTitle && primaryTitle === pageTitle) {
      flags.push({
        checkId: 'corridor-og-title-drift',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        impactTag: 'SHARING',
        problem: 'Multiple corridor pages share the same Open Graph title',
        evidence: `Primary and ${page.role} (${page.url}) both use og:title "${primary.ogTitle}".`,
        fix: '1. Give each key page a unique og:title that matches its H1\n2. Keep brand name consistent but vary the offer\n3. Re-check social previews after deploy',
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
        problem: 'Corridor pages reuse the same Open Graph description',
        evidence: `Primary and ${page.role} share an identical og:description.`,
        fix: '1. Write a page-specific og:description for pricing/signup/features\n2. Mirror the unique value of that step in the funnel\n3. Keep length under 160 characters',
        confidence: 0.85,
        source: 'DETERMINISTIC',
        pageUrl: page.url,
        ...evidence,
      })
    }
  }

  return { flags, assertions }
}
