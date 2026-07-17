import { RUBRIC_ORDER, SEVERITY_ORDER } from '@/lib/audit/constants'
import {
  computeRubricScores,
  type RubricScoreContext,
} from '@/lib/audit/checks/rubric'
import type { DeterministicFlag } from '@/lib/audit/checks'
import { calculateOverallScore } from '@/lib/audit/scoring'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import sampleEvidenceAnchors from '@/lib/marketing/sample-evidence-anchors.json'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import {
  buildPipelineSteps,
  type PipelineStep,
  type PipelineStepState,
} from '@/lib/audit/report-pipeline-steps'
import { displayVerdict } from '@/lib/audit/verdict'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import {
  buildExpertFixPrompt,
  formatDisplayEvidence,
  resolveWhyItMatters,
} from '@/lib/audit/flag-copy'
import {
  buildEvidenceHighlightsForFlag,
  parseEvidenceAnchorsFromPerformanceData,
  type EvidenceHighlight,
} from '@/lib/audit/evidence-highlights'
import { rubricLabel, severityLabel } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

export type { PipelineStep, PipelineStepState }
export type { EvidenceHighlight }

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
  fixPrompt: string
  verificationRule: string | null
  evidenceHighlights: EvidenceHighlight[]
  evidenceDevices: ('desktop' | 'mobile')[]
  /** Prefer mobile screenshot for experience flags */
  preferredDevice: 'desktop' | 'mobile'
  pageUrl: string | null
}

export interface SampleReportDisplay {
  id: string
  url: string
  /** Raw hostname from the audited URL. */
  host: string
  /** User-facing site label (e.g. LaunchPad demo). */
  displayHost: string
  contextTag: string
  isDemoFixture: boolean
  pageType: string | null
  score: number | null
  grade: string | null
  verdict: string | null
  flagCount: number
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  rubricScores: { name: string; score: number | null; grade: string | null }[]
  rubricSummaries: Record<string, string>
  pipelineSteps: PipelineStep[]
  flags: SampleFlagDisplay[]
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

function flagToDeterministic(flag: RankableFlag): DeterministicFlag | null {
  if (!flag.checkId) return null
  return {
    checkId: flag.checkId,
    rubric: flag.rubric as DeterministicFlag['rubric'],
    severity: flag.severity as DeterministicFlag['severity'],
    problem: flag.problem,
    evidence: flag.evidence ?? '',
    fix: flag.fix ?? '',
    confidence: flag.confidence ?? 0.8,
    impactTag: flag.impactTag as DeterministicFlag['impactTag'],
    pageUrl: flag.pageUrl ?? undefined,
    source: 'DETERMINISTIC',
  }
}

function evidenceCoverageContext(audit: LiveSampleAudit): RubricScoreContext {
  const evidence = audit.evidenceCoverage as {
    desktopPageSpeed?: boolean
    mobilePageSpeed?: boolean
  } | null

  const perf = audit.performanceData as {
    desktop?: { score: number | null } | null
    mobile?: { score: number | null } | null
  } | null

  return {
    pageSpeedAvailable: {
      desktop:
        evidence?.desktopPageSpeed ??
        (perf?.desktop != null && perf.desktop.score != null),
      mobile:
        evidence?.mobilePageSpeed ?? (perf?.mobile != null && perf.mobile.score != null),
    },
  }
}

export function resolveDisplayScores(audit: LiveSampleAudit): {
  overall: number
  rubrics: Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number>
} {
  const detFlags = audit.flags
    .map(flagToDeterministic)
    .filter((f): f is DeterministicFlag => f !== null)

  const computed = computeRubricScores(detFlags, null, null, evidenceCoverageContext(audit))

  const rubrics = { ...computed }
  for (const name of RUBRIC_ORDER) {
    const stored = audit.rubricRows.find((r) => r.name === name)
    if (stored?.score != null) {
      rubrics[name] = stored.score
    }
  }

  const overall = audit.score ?? calculateOverallScore(rubrics) ?? calculateOverallScore(computed)!
  return { overall, rubrics }
}

const STATIC_ANCHORS = sampleEvidenceAnchors as EvidenceAnchorMap

function resolveSampleAnchors(audit: LiveSampleAudit): EvidenceAnchorMap {
  const live = parseEvidenceAnchorsFromPerformanceData(audit.performanceData)
  if (live && Object.keys(live).length > 0) return live
  return STATIC_ANCHORS
}

function buildEvidenceHighlights(
  flag: RankableFlag,
  index: number,
  anchors: EvidenceAnchorMap
): EvidenceHighlight[] {
  return buildEvidenceHighlightsForFlag(flag, index, anchors)
}

export function buildAllEvidenceHighlights(flags: SampleFlagDisplay[]): EvidenceHighlight[] {
  return flags.flatMap((flag) => flag.evidenceHighlights)
}

function mapFlag(
  flag: RankableFlag,
  index: number,
  anchors: EvidenceAnchorMap
): SampleFlagDisplay {
  return {
    id: flag.id,
    checkId: flag.checkId ?? null,
    index,
    rubric: flag.rubric,
    rubricLabel: rubricLabel(flag.rubric),
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    impactTag: flag.impactTag ?? null,
    title: flag.problem,
    description: resolveWhyItMatters(flag),
    evidence: formatDisplayEvidence(flag.checkId, flag.evidence ?? flag.problem),
    whyItMatters: resolveWhyItMatters(flag),
    fix: flag.fix ?? '',
    agentPrompt: flag.agentPrompt ?? flag.fix ?? '',
    fixPrompt: buildExpertFixPrompt(flag),
    verificationRule: flag.verificationRule ?? null,
    evidenceHighlights: buildEvidenceHighlights(flag, index, anchors),
    evidenceDevices: devicesForCheck(flag.checkId ?? flag.id),
    preferredDevice: flag.rubric === 'EXPERIENCE' ? 'mobile' : 'desktop',
    pageUrl: flag.pageUrl ?? null,
  }
}

export function buildSampleReportDisplay(audit: LiveSampleAudit): SampleReportDisplay {
  const anchors = resolveSampleAnchors(audit)
  const sorted = sortFlags(audit.flags)
  const flags = sorted.map((flag, index) => mapFlag(flag, index, anchors))
  const desktop = audit.screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = audit.screenshots.find((s) => s.device === 'MOBILE')
  const { overall, rubrics } = resolveDisplayScores(audit)

  const rubricScores = RUBRIC_ORDER.map((name) => {
    const score = rubrics[name]
    return {
      name: rubricLabel(name),
      score,
      grade: gradeFromScore(score),
    }
  })

  const site = getSampleSiteDisplay(audit.url)

  return {
    id: audit.id,
    url: audit.url,
    host: displayHostname(audit.url),
    displayHost: site.displayHost,
    contextTag: site.contextTag,
    isDemoFixture: site.isDemoFixture,
    pageType: audit.pageType,
    score: overall,
    grade: gradeFromScore(overall),
    verdict: displayVerdict(audit.verdict),
    flagCount: flags.length,
    desktopScreenshot: desktop?.url ?? null,
    mobileScreenshot: mobile?.url ?? null,
    rubricScores,
    rubricSummaries: Object.fromEntries(
      audit.rubricRows.map((row) => [row.name, row.summary ?? ''])
    ),
    pipelineSteps: buildPipelineSteps({
      flagCount: flags.length,
      pageType: audit.pageType,
      mode: 'sample',
    }),
    flags,
  }
}
