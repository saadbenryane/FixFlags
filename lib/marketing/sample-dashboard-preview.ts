import type { SampleFlagDisplay, SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { impactTagLabel, severityLabel } from '@/lib/utils'

export const SAMPLE_DASHBOARD_ISSUE_CAP = 5
export const SAMPLE_FIX_PROMPT_MAX = 160

export interface SampleDashboardIssuePreview {
  id: string
  title: string
  /** Raw product severity (CRITICAL / IMPORTANT / POLISH). */
  severity: string
  severityLabel: string
  rubric: string
}

export interface SampleDashboardSelectedPreview {
  title: string
  why: string
  fixPrompt: string
  hasFixPrompt: boolean
  severity: string
  severityLabel: string
  impactLabels: string[]
}

export interface SampleDashboardRubricScore {
  name: string
  label: string
  score: number | null
}

export interface SampleDashboardPreview {
  host: string
  score: number | null
  /** Formatted sample completion date when available (e.g. "Jun 10, 2026"). */
  checkedAtLabel: string | null
  flagCount: number
  rubricCounts: {
    message: number
    experience: number
    reach: number
  }
  rubricScores: SampleDashboardRubricScore[]
  issues: SampleDashboardIssuePreview[]
  selected: SampleDashboardSelectedPreview | null
}

function truncateFixPrompt(text: string, max = SAMPLE_FIX_PROMPT_MAX): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function formatCheckedAtLabel(completedAt: Date | null): string | null {
  if (!completedAt) return null
  const date = completedAt instanceof Date ? completedAt : new Date(completedAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function issueFromFlag(flag: SampleFlagDisplay): SampleDashboardIssuePreview {
  return {
    id: flag.id,
    title: flag.title,
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    rubric: flag.rubricLabel,
  }
}

function selectedFromFlag(flag: SampleFlagDisplay): SampleDashboardSelectedPreview {
  const fixSource = flag.fixPrompt || flag.fix || ''
  const impact = impactTagLabel(flag.impactTag)
  return {
    title: flag.title,
    why: flag.whyItMatters,
    fixPrompt: truncateFixPrompt(fixSource),
    hasFixPrompt: fixSource.trim().length > 0,
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    impactLabels: impact ? [impact] : [],
  }
}

function rubricLabel(name: string): string {
  const map: Record<string, string> = {
    MESSAGE: 'Message',
    EXPERIENCE: 'Experience',
    REACH: 'Reach',
  }
  return map[name] ?? name
}

/**
 * Pure homepage sample dashboard view-model.
 * Never invents Flags, scores, or fake trends, only projects sample report data.
 */
export function buildSampleDashboardPreview(
  report: SampleReportDisplay,
  options?: { issueCap?: number }
): SampleDashboardPreview {
  const issueCap = options?.issueCap ?? SAMPLE_DASHBOARD_ISSUE_CAP
  const flags = report.flags

  const rubricCounts = {
    message: flags.filter((f) => f.rubric === 'MESSAGE').length,
    experience: flags.filter((f) => f.rubric === 'EXPERIENCE').length,
    reach: flags.filter((f) => f.rubric === 'REACH').length,
  }

  const issues = flags.slice(0, issueCap).map(issueFromFlag)
  const selectedFlag = flags[0] ?? null

  const rubricScores = report.rubricScores.map((row) => ({
    name: row.name,
    label: rubricLabel(row.name),
    score: row.score,
  }))

  return {
    host: report.displayHost,
    score: report.score,
    checkedAtLabel: formatCheckedAtLabel(report.completedAt),
    flagCount: report.flagCount,
    rubricCounts,
    rubricScores,
    issues,
    selected: selectedFlag ? selectedFromFlag(selectedFlag) : null,
  }
}
