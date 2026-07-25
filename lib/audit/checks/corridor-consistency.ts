import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'

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
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Cross-page OG consistency across the critical-path corridor.
 * Compares secondary pages against the primary (homepage) share preview.
 */
export function runCorridorConsistencyChecks(pages: CorridorPageMeta[]): DeterministicFlag[] {
  if (pages.length < 2) return []
  const primary = pages.find((p) => p.role === 'primary') ?? pages[0]
  const primaryTitle = normalizeText(primary.ogTitle || primary.title)
  const primaryDesc = normalizeText(primary.ogDescription)
  const flags: DeterministicFlag[] = []

  for (const page of pages) {
    if (page.url === primary.url) continue
    const pageTitle = normalizeText(page.ogTitle || page.title)
    const pageDesc = normalizeText(page.ogDescription)

    if (primaryTitle && pageTitle && primaryTitle === pageTitle) {
      flags.push({
        checkId: 'corridor-og-title-drift',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        impactTag: 'SHARING',
        problem: 'Multiple corridor pages share the same Open Graph title',
        evidence: `Primary and ${page.role} (${page.url}) both use og:title "${primary.ogTitle || primary.title}".`,
        fix: '1. Give each key page a unique og:title that matches its H1\n2. Keep brand name consistent but vary the offer\n3. Re-check social previews after deploy',
        confidence: 0.9,
        source: 'DETERMINISTIC',
        pageUrl: page.url,
      })
      break
    }

    if (primaryDesc && pageDesc && primaryDesc === pageDesc && primaryDesc.length > 20) {
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
      })
      break
    }
  }

  return flags
}
