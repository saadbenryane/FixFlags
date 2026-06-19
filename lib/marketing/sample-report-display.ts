import { RUBRIC_ORDER, SEVERITY_ORDER } from '@/lib/audit/constants'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import sampleEvidenceAnchors from '@/lib/marketing/sample-evidence-anchors.json'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
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

/** Normalized pin center on a screenshot (0–1). */
export interface EvidenceHighlight {
  id: string
  device: 'desktop' | 'mobile'
  x: number
  y: number
  label: string
  detail: string
}

export interface DesignTierSuggestion {
  tier: DesignTier
  label: string
  suggestion: string
}

export interface SampleFlagDisplay {
  id: string
  checkId?: string | null
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
  verificationRule: string | null
  designTiers: DesignTierSuggestion[]
  evidenceHighlights: EvidenceHighlight[]
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
  rubricSummaries: Record<string, string>
  pipelineSteps: PipelineStep[]
  scans: ScanCheck[]
  flags: SampleFlagDisplay[]
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

const ANCHORS = sampleEvidenceAnchors as EvidenceAnchorMap

function preferredDeviceForFlag(flag: RankableFlag): 'desktop' | 'mobile' {
  return flag.rubric === 'EXPERIENCE' ? 'mobile' : 'desktop'
}

function lookupAnchor(flag: RankableFlag, device: 'desktop' | 'mobile') {
  const key = flag.checkId ?? flag.id
  const entry = ANCHORS[key]
  if (!entry) return null
  return entry[device] ?? entry.desktop ?? entry.mobile ?? null
}

function buildEvidenceHighlights(flag: RankableFlag): EvidenceHighlight[] {
  const device = preferredDeviceForFlag(flag)
  const anchor = lookupAnchor(flag, device)

  if (!anchor) {
    if (!flag.evidence) return []
    return [
      {
        id: `${flag.id}-fallback`,
        device,
        x: 0.5,
        y: 0.28,
        label: flag.problem,
        detail: flag.evidence,
      },
    ]
  }

  return [
    {
      id: flag.checkId ?? flag.id,
      device,
      x: anchor.x,
      y: anchor.y,
      label: flag.problem,
      detail: flag.evidence ?? flag.problem,
    },
  ]
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
  return {
    id: flag.id,
    checkId: flag.checkId ?? null,
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
    verificationRule: flag.verificationRule ?? null,
    designTiers: buildDesignTiers(flag),
    evidenceHighlights: buildEvidenceHighlights(flag),
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
    rubricSummaries: Object.fromEntries(
      audit.rubricRows.map((row) => [row.name, row.summary ?? ''])
    ),
    pipelineSteps: buildPipelineSteps(flags.length),
    scans: buildScans(flags),
    flags,
  }
}
