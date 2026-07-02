import { createHash } from 'node:crypto'
import type { DeterministicFlag } from '@/lib/audit/checks'
import type { JudgeOutput } from '@/lib/audit/judge-schema'
import type { TriageOutput } from '@/lib/audit/judge-triage-schema'

function normalizedWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
  )
}

function similarity(a: string, b: string): number {
  const left = normalizedWords(a)
  const right = normalizedWords(b)
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  for (const word of left) {
    if (right.has(word)) intersection++
  }
  return intersection / (left.size + right.size - intersection)
}

/** Themes where AI flags often paraphrase deterministic checks across rubrics. */
const DETERMINISTIC_AI_THEMES: Array<{ checkIds: string[]; keywords: RegExp }> = [
  {
    checkIds: ['cta-below-fold-mobile', 'no-cta-detected', 'flow-no-cta-found'],
    keywords:
      /below fold|above fold|hidden below|scroll depth|mobile cta|primary cta|cta not visible|without scrolling/i,
  },
  {
    checkIds: ['og-image-missing', 'og-image-broken'],
    keywords: /og:image|og image|link preview|social share|blank card|preview card|open graph image/i,
  },
  {
    checkIds: ['description-missing', 'description-too-short', 'description-too-long'],
    keywords: /meta description|description tag|search snippet/i,
  },
  {
    checkIds: ['title-missing', 'title-too-short', 'title-too-long'],
    keywords: /page title|title tag|document title|<title>/i,
  },
  {
    checkIds: ['h1-generic', 'template-default-copy', 'placeholder-copy-detected'],
    keywords: /generic headline|h1 heading|hero headline|template copy|placeholder copy|welcome to/i,
  },
  {
    checkIds: ['robots-blocks-indexing'],
    keywords: /noindex|robots meta|blocking indexing|search engines cannot crawl/i,
  },
  {
    checkIds: ['console-errors-critical', 'console-errors-some'],
    keywords: /console error|javascript error|js error|runtime error/i,
  },
  {
    checkIds: ['mobile-perf-critical', 'mobile-perf-poor', 'mobile-lcp-critical', 'lcp-critical', 'lcp-poor'],
    keywords: /mobile performance|pagespeed|largest contentful paint|\blcp\b|load time/i,
  },
  {
    checkIds: ['tap-targets-small'],
    keywords: /tap target|touch target|48x48|48×48/i,
  },
]

function matchesDeterministicTheme(
  deterministic: DeterministicFlag[],
  candidate: JudgeOutput['newFlags'][number]
): boolean {
  const combined = `${candidate.problem} ${candidate.evidence} ${candidate.whyItMatters ?? ''}`

  for (const theme of DETERMINISTIC_AI_THEMES) {
    if (!theme.keywords.test(combined)) continue
    if (deterministic.some((flag) => theme.checkIds.includes(flag.checkId))) {
      return true
    }
  }

  return false
}

function isNearDuplicateOfDeterministic(
  flag: DeterministicFlag,
  candidate: JudgeOutput['newFlags'][number]
): boolean {
  if (similarity(flag.problem, candidate.problem) >= 0.5) return true
  if (
    similarity(
      `${flag.problem} ${flag.evidence}`,
      `${candidate.problem} ${candidate.evidence}`
    ) >= 0.55
  ) {
    return true
  }
  return false
}

export function flagFingerprint(input: {
  checkId?: string | null
  pageUrl?: string | null
  rubric: string
  problem: string
}): string {
  const identity = input.checkId
    ? `check:${input.checkId}`
    : `problem:${[...normalizedWords(input.problem)].sort().join(' ')}`
  return createHash('sha256')
    .update(`${input.rubric}|${input.pageUrl ?? 'primary'}|${identity}`)
    .digest('hex')
}

export function deduplicateFlags(
  deterministic: DeterministicFlag[],
  aiFlags: JudgeOutput['newFlags']
): JudgeOutput['newFlags'] {
  const accepted: JudgeOutput['newFlags'] = []

  for (const candidate of aiFlags) {
    const duplicatesDeterministic =
      matchesDeterministicTheme(deterministic, candidate) ||
      deterministic.some((flag) => isNearDuplicateOfDeterministic(flag, candidate))

    if (duplicatesDeterministic) continue

    const duplicatesAi = accepted.some(
      (flag) =>
        similarity(
          `${flag.problem} ${flag.evidence}`,
          `${candidate.problem} ${candidate.evidence}`
        ) >= 0.65
    )
    if (!duplicatesAi) accepted.push(candidate)
  }

  return accepted
}

export function deduplicateTriageFlags(
  deterministic: DeterministicFlag[],
  aiFlags: TriageOutput['newFlags']
): TriageOutput['newFlags'] {
  const accepted: TriageOutput['newFlags'] = []

  for (const candidate of aiFlags) {
    const asJudgeFlag = { ...candidate, evidence: candidate.problem, fix: '', whyItMatters: '' }
    const duplicatesDeterministic =
      matchesDeterministicTheme(deterministic, asJudgeFlag) ||
      deterministic.some((flag) => isNearDuplicateOfDeterministic(flag, asJudgeFlag))

    if (duplicatesDeterministic) continue

    const duplicatesAi = accepted.some(
      (flag) => similarity(flag.problem, candidate.problem) >= 0.65
    )
    if (!duplicatesAi) accepted.push(candidate)
  }

  return accepted
}
