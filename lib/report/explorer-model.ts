import {
  buildAllEvidenceHighlights,
  formatFlagEvidence,
  formatFlagFixPrompt,
  type EvidenceHighlight,
} from '@/lib/audit/evidence-highlights'
import {
  resolveFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import {
  buildRubricScoreRows,
  type RubricScoreRow,
} from '@/lib/audit/report-pipeline-steps'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import { severityRank, impactTagLabel, rubricLabel, severityLabel } from '@/lib/utils'
import type { SampleFlagDisplay, SampleReportDisplay } from '@/lib/marketing/sample-report-display'

export interface ExplorerFlag {
  id: string
  title: string
  rubric: string
  rubricLabel: string
  severity: string
  severityLabel: string
  impactTag: string | null
  whyItMatters: string
  evidence: string
  fixPrompt: string
  copyFixPrompt: string
  verificationRule: string | null
  evidenceDevices: ('desktop' | 'mobile')[]
  hasFixPrompt: boolean
}

export interface ReportExplorerModel {
  displayHost: string
  pageType: string | null
  score: number | null
  verdict: string | null
  flagCount: number
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  rubricScores: RubricScoreRow[]
  flags: ExplorerFlag[]
  allHighlights: EvidenceHighlight[]
}

function sortFlags(flags: RankableFlag[]): RankableFlag[] {
  return [...flags].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
}

function mapLiveFlag(flag: RankableFlag): ExplorerFlag {
  const copyFixPrompt = resolveFixPrompt(flag) ?? flag.fix ?? flag.problem
  const key = flag.checkId ?? flag.id
  return {
    id: flag.id,
    title: flag.problem,
    rubric: flag.rubric,
    rubricLabel: rubricLabel(flag.rubric),
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    impactTag: impactTagLabel(flag.impactTag),
    whyItMatters: flag.whyItMatters ?? '',
    evidence: formatFlagEvidence(flag),
    fixPrompt: formatFlagFixPrompt(flag, copyFixPrompt),
    copyFixPrompt,
    verificationRule: flag.verificationRule ?? null,
    evidenceDevices: flag.checkId ? devicesForCheck(flag.checkId) : ['desktop', 'mobile'],
    hasFixPrompt: Boolean(copyFixPrompt),
  }
}

export function buildLiveExplorerModel(input: {
  url: string
  pageType: string | null
  score: number | null
  verdict: string | null
  flags: RankableFlag[]
  screenshots?: AuditScreenshot[]
  rubricRows: Array<{ name: string; score: number | null; grade?: string | null }>
  evidenceAnchors?: EvidenceAnchorMap
}): ReportExplorerModel {
  const sorted = sortFlags(input.flags)
  const desktop = input.screenshots?.find((s) => s.device === 'DESKTOP')?.url ?? null
  const mobile = input.screenshots?.find((s) => s.device === 'MOBILE')?.url ?? null
  const displayHost = (() => {
    try {
      return new URL(input.url).hostname.replace(/^www\./, '')
    } catch {
      return input.url
    }
  })()

  return {
    displayHost,
    pageType: input.pageType,
    score: input.score,
    verdict: input.verdict,
    flagCount: sorted.length,
    desktopScreenshot: desktop,
    mobileScreenshot: mobile,
    rubricScores: buildRubricScoreRows(input.rubricRows),
    flags: sorted.map((flag) => mapLiveFlag(flag)),
    allHighlights: buildAllEvidenceHighlights(sorted, input.evidenceAnchors),
  }
}

function mapSampleFlag(flag: SampleFlagDisplay): ExplorerFlag {
  return {
    id: flag.id,
    title: flag.title,
    rubric: flag.rubric,
    rubricLabel: flag.rubricLabel,
    severity: flag.severity,
    severityLabel: flag.severityLabel,
    impactTag: flag.impactTag,
    whyItMatters: flag.whyItMatters,
    evidence: flag.evidence,
    fixPrompt: flag.fixPrompt,
    copyFixPrompt: flag.agentPrompt || flag.fix,
    verificationRule: flag.verificationRule,
    evidenceDevices: flag.evidenceDevices,
    hasFixPrompt: Boolean(flag.fixPrompt),
  }
}

export function buildSampleExplorerModel(report: SampleReportDisplay): ReportExplorerModel {
  return {
    displayHost: report.displayHost,
    pageType: report.pageType,
    score: report.score,
    verdict: report.verdict,
    flagCount: report.flagCount,
    desktopScreenshot: report.desktopScreenshot,
    mobileScreenshot: report.mobileScreenshot,
    rubricScores: report.rubricScores,
    flags: report.flags.map(mapSampleFlag),
    allHighlights: report.flags.flatMap((f) => f.evidenceHighlights),
  }
}
