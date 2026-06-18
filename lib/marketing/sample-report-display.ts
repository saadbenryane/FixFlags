import { RUBRIC_ORDER, SEVERITY_ORDER } from '@/lib/audit/constants'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { impactTagLabel, rubricLabel, severityLabel } from '@/lib/utils'

export type PipelineStepState = 'done' | 'active' | 'pending'

export type DesignTier = 'good' | 'great' | 'award'

export interface PipelineStep {
  id: string
  label: string
  detail: string
  state: PipelineStepState
}

/** One automated check in the scan timeline. */
export interface ScanCheck {
  id: string
  label: string
  /** null = check failed or skipped — render nothing */
  score: number | null
  /** Links to a flag for prev/next navigation */
  flagIndex?: number
  /** Critical finding — show orange flag pin instead of a bar */
  isCritical?: boolean
}

export interface UiGuidelineCheck {
  id: string
  label: string
  passed: boolean
}

export interface DesignTierSuggestion {
  tier: DesignTier
  label: string
  suggestion: string
}

export interface SampleFlagDisplay {
  id: string
  index: number
  rubric: string
  rubricLabel: string
  severity: string
  severityLabel: string
  impactTag: string | null
  title: string
  description: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt: string
  verificationSteps: string[]
  designTiers: DesignTierSuggestion[]
  guidelines: UiGuidelineCheck[]
  /** Prefer mobile screenshot for experience flags */
  preferredDevice: 'desktop' | 'mobile'
}

export interface SampleReportDisplay {
  id: string
  url: string
  host: string
  pageType: string | null
  score: number | null
  grade: string | null
  verdict: string | null
  flagCount: number
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  rubricScores: { name: string; score: number; grade: string | null }[]
  pipelineSteps: PipelineStep[]
  scans: ScanCheck[]
  flags: SampleFlagDisplay[]
}

const RUBRIC_GUIDELINES: Record<string, UiGuidelineCheck[]> = {
  MESSAGE: [
    { id: 'clarity', label: 'Clarity', passed: true },
    { id: 'match', label: 'Match system & real world', passed: true },
    { id: 'recognition', label: 'Recognition over recall', passed: false },
  ],
  EXPERIENCE: [
    { id: 'aesthetic', label: 'Aesthetic & minimalist design', passed: false },
    { id: 'control', label: 'User control & freedom', passed: true },
    { id: 'consistency', label: 'Consistency & standards', passed: true },
  ],
  REACH: [
    { id: 'recognition', label: 'Recognition over recall', passed: false },
    { id: 'help', label: 'Help & documentation', passed: true },
    { id: 'status', label: 'Visibility of system status', passed: true },
  ],
}

const DESIGN_TIER_LABELS: Record<DesignTier, string> = {
  good: 'Good design',
  great: 'Great design',
  award: 'Award-winning',
}

function sortFlags(flags: RankableFlag[]): RankableFlag[] {
  const severityRank = Object.fromEntries(SEVERITY_ORDER.map((s, i) => [s, i]))
  return [...flags].sort((a, b) => {
    const sa = severityRank[a.severity] ?? 99
    const sb = severityRank[b.severity] ?? 99
    if (sa !== sb) return sa - sb
    return a.problem.localeCompare(b.problem)
  })
}

function gradeFromScore(score: number | null): string | null {
  if (score == null) return null
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

function buildDesignTiers(flag: RankableFlag): DesignTierSuggestion[] {
  const good = flag.fix ?? 'Address the flagged issue with a focused, shippable change.'
  const great =
    flag.agentPrompt ??
    `${good} Apply the change in the smallest surface area and verify at the flagged viewport.`
  const award = `${great} Push beyond the minimum: tighten hierarchy, add one proof point, and make the result screenshot-worthy — the kind of polish that earns trust in the first 5 seconds.`

  return (['good', 'great', 'award'] as const).map((tier) => ({
    tier,
    label: DESIGN_TIER_LABELS[tier],
    suggestion: tier === 'good' ? good : tier === 'great' ? great : award,
  }))
}

function buildVerificationSteps(flag: RankableFlag): string[] {
  const steps: string[] = []
  if (flag.evidence) steps.push(`Confirm evidence: ${flag.evidence}`)
  if (flag.verificationRule) steps.push(flag.verificationRule)
  if (flag.whyItMatters) steps.push(`Validate impact: ${flag.whyItMatters}`)
  return steps
}

function buildPipelineSteps(flagCount: number): PipelineStep[] {
  return [
    { id: 'capture', label: 'Site captured', detail: 'Homepage', state: 'done' },
    { id: 'checks', label: 'Checks complete', detail: '24 checks', state: 'done' },
    {
      id: 'flags',
      label: 'Flags found',
      detail: String(flagCount),
      state: flagCount > 0 ? 'active' : 'done',
    },
    { id: 'prompts', label: 'Fix prompts ready', detail: 'Cursor-ready', state: 'pending' },
    { id: 'ready', label: 'Review ready', detail: 'After scoring', state: 'pending' },
  ]
}

function buildScans(flags: SampleFlagDisplay[]): ScanCheck[] {
  /**
   * 24 illustrative checks — deterministic layout.
   * Failed checks (null) render as gaps. Critical flags get orange pins; others get colored bars.
   */
  const slots: Array<Omit<ScanCheck, 'id'>> = [
    { label: 'HTTPS', score: 100 },
    { label: 'Page load', score: 86 },
    { label: 'Headline clarity', score: 72 },
    { label: 'Font loading', score: null },
    { label: 'Meta title', score: 91 },
    { label: 'Mobile CTA', score: 32, flagIndex: 0, isCritical: true },
    { label: 'Tap targets', score: 84 },
    { label: 'Color contrast', score: 88 },
    { label: 'Hero hierarchy', score: 68 },
    { label: 'Third-party scripts', score: 74, flagIndex: 5 },
    { label: 'Nav height', score: 58, flagIndex: 2 },
    { label: 'Social preview', score: 28, flagIndex: 1, isCritical: true },
    { label: 'og:title', score: 82 },
    { label: 'Meta description', score: 54, flagIndex: 4 },
    { label: 'Analytics tag', score: null },
    { label: 'Heading order', score: 90 },
    { label: 'CTA copy', score: 76, flagIndex: 3 },
    { label: 'Trust signals', score: 85 },
    { label: 'Mobile layout', score: 61 },
    { label: 'Link previews', score: 79 },
    { label: 'Favicon', score: 95 },
    { label: 'Console errors', score: 93 },
    { label: 'Privacy links', score: 97 },
    { label: 'Share card', score: 88 },
  ]

  return slots.map((slot, i) => {
    const flagIndex = slot.flagIndex
    const isCritical =
      slot.isCritical ??
      (flagIndex != null && flags[flagIndex]?.severity === 'CRITICAL')

    return {
      id: `scan-${i + 1}`,
      ...slot,
      isCritical: isCritical || undefined,
    }
  })
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function mapFlag(flag: RankableFlag, index: number): SampleFlagDisplay {
  const guidelines = (RUBRIC_GUIDELINES[flag.rubric] ?? RUBRIC_GUIDELINES.MESSAGE).map((g) => ({
    ...g,
    passed: flag.severity === 'POLISH' ? true : g.passed,
  }))

  return {
    id: flag.id,
    index,
    rubric: flag.rubric,
    rubricLabel: rubricLabel(flag.rubric),
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    impactTag: impactTagLabel(flag.impactTag),
    title: flag.problem,
    description: flag.whyItMatters ?? flag.problem,
    evidence: flag.evidence ?? '',
    whyItMatters: flag.whyItMatters ?? '',
    fix: flag.fix ?? '',
    agentPrompt: flag.agentPrompt ?? flag.fix ?? '',
    verificationSteps: buildVerificationSteps(flag),
    designTiers: buildDesignTiers(flag),
    guidelines,
    preferredDevice: flag.rubric === 'EXPERIENCE' ? 'mobile' : 'desktop',
  }
}

export function buildSampleReportDisplay(audit: LiveSampleAudit): SampleReportDisplay {
  const sorted = sortFlags(audit.flags)
  const flags = sorted.map((flag, index) => mapFlag(flag, index))
  const desktop = audit.screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = audit.screenshots.find((s) => s.device === 'MOBILE')

  const rubricScores = RUBRIC_ORDER.map((name) => {
    const row = audit.rubricRows.find((r) => r.name === name)
    return {
      name: rubricLabel(name),
      score: row?.score ?? 0,
      grade: row?.grade ?? null,
    }
  })

  return {
    id: audit.id,
    url: audit.url,
    host: hostFromUrl(audit.url),
    pageType: audit.pageType,
    score: audit.score,
    grade: gradeFromScore(audit.score),
    verdict: audit.verdict,
    flagCount: flags.length,
    desktopScreenshot: desktop?.url ?? null,
    mobileScreenshot: mobile?.url ?? null,
    rubricScores,
    pipelineSteps: buildPipelineSteps(flags.length),
    scans: buildScans(flags),
    flags,
  }
}
