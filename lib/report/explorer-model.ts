import {
  buildExpertFixPrompt,
  formatDisplayEvidence,
  resolveWhyItMatters,
} from '@/lib/audit/flag-copy'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import {
  buildPlanModePrompt,
  resolveFixPrompt,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import type { PromptToolKey } from '@/lib/mcp/builders'
import {
  buildAllEvidenceHighlights,
  type EvidenceHighlight,
} from '@/lib/audit/evidence-highlights'
import { displayHostname } from '@/lib/utils/url-helpers'
import {
  buildRubricScoreRows,
  type RubricScoreRow,
} from '@/lib/audit/report-pipeline-steps'
import {
  normalizeInternalScreenshotUrl,
  type AuditScreenshot,
} from '@/lib/audit/screenshot-types'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import { rubricLabel, severityLabel } from '@/lib/utils'
import type { SampleFlagDisplay, SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import type { ProductContract } from '@/lib/audit/product-contract'
import { buildFixList, type FixList } from '@/lib/audit/finish-plan'

/**
 * Derive a visitor-facing truth label from the flag's source and checkId.
 * - REPRODUCED → "Reproduced" (journey/playwright confirmed the issue)
 * - DETERMINISTIC + checkId → "Detected" (rule-based check found it)
 * - AI → "Observed" (AI reviewer saw it in screenshots/text)
 * - AI + uncertain → "Likely cause" (AI inferred but not 100%)
 */
export function deriveTruthLabel(source: string | null | undefined, checkId: string | null): string {
  if (source === 'JOURNEY') return 'Reproduced'
  if (
    checkId &&
    (checkId.startsWith('overlay-blocks-') ||
      checkId.startsWith('api-engagement-') ||
      checkId.startsWith('form-submit-') ||
      checkId.startsWith('flow-'))
  ) {
    return 'Reproduced'
  }
  if (source === 'DETERMINISTIC' && checkId) return 'Detected'
  if (source === 'AI') return 'Observed'
  return 'Observed'
}

export interface ExplorerFlag {
  id: string
  checkId: string | null
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
  toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>>
  verificationRule: string | null
  affectedDevices: ('desktop' | 'mobile')[]
  hasFixPrompt: boolean
  pageUrl: string | null
  pageUrls: string[]
  occurrenceCount: number
  /** Animated GIF or overlay/side-by-side image URL for this flag. */
  visualUrl?: string | null
  /** Derived truth label: Reproduced / Detected / Observed / Likely cause. */
  truthLabel: string
}

/**
 * Project the model's captures back into the shared screenshot shape the
 * browser panel consumes, so curated surfaces render captures through the
 * same component as a live review.
 */
export function explorerScreenshots(model: {
  desktopScreenshot: string | null
  mobileScreenshot: string | null
}): AuditScreenshot[] {
  const captures: AuditScreenshot[] = []
  if (model.desktopScreenshot) {
    captures.push({
      device: 'DESKTOP',
      url: model.desktopScreenshot,
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    })
  }
  if (model.mobileScreenshot) {
    captures.push({
      device: 'MOBILE',
      url: model.mobileScreenshot,
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
    })
  }
  return captures
}

export interface ReportExplorerModel {
  displayHost: string
  pageType: string | null
  score: number | null
  flagCount: number
  /** All ranked flags bundled for one editor session. Null when prompts are gated. */
  polishPassPrompt: string | null
  desktopScreenshot: string | null
  mobileScreenshot: string | null
  rubricScores: RubricScoreRow[]
  flags: ExplorerFlag[]
  allHighlights: EvidenceHighlight[]
  previewMeta: PreviewMeta | null
}

function mapLiveFlag(
  flag: RankableFlag,
  visualByCheckId?: Record<string, { gifUrl?: string | null; overlayUrl?: string | null }>,
  mayShowPrompt = true,
  occurrences: { pageUrls: string[]; count: number } = {
    pageUrls: flag.pageUrl ? [flag.pageUrl] : [],
    count: 1,
  },
  copyBundle = ''
): ExplorerFlag {
  const fixPrompt = mayShowPrompt ? buildExpertFixPrompt(flag) : ''
  const copyFixPrompt =
    copyBundle ||
    (mayShowPrompt ? buildPlanModePrompt([flag], { limit: 1 }) : '')
  const sourceFix = resolveFixPrompt(flag)
  const visual = flag.checkId ? visualByCheckId?.[flag.checkId] : undefined
  const visualUrl = visual?.gifUrl || visual?.overlayUrl || null
  return {
    id: flag.id,
    checkId: flag.checkId ?? null,
    title: flag.problem,
    rubric: flag.rubric,
    rubricLabel: rubricLabel(flag.rubric),
    severity: flag.severity,
    severityLabel: severityLabel(flag.severity),
    impactTag: flag.impactTag ?? null,
    whyItMatters: resolveWhyItMatters(flag),
    evidence: flag.evidence
      ? formatDisplayEvidence(flag.checkId, flag.evidence)
      : '',
    fixPrompt,
    copyFixPrompt,
    toolPrompts: mayShowPrompt
      ? {
          universal: flag.agentPrompt,
          cursor: flag.cursorPrompt,
          claude: flag.claudePrompt,
          windsurf: flag.windsurfPrompt,
          lovable: flag.lovablePrompt,
          bolt: flag.boltPrompt,
        }
      : {},
    verificationRule: flag.verificationRule ?? null,
    affectedDevices: flag.checkId
      ? devicesForCheck(flag.checkId)
      : [flag.rubric === 'EXPERIENCE' ? 'mobile' : 'desktop'],
    hasFixPrompt: mayShowPrompt && Boolean(sourceFix),
    pageUrl: flag.pageUrl ?? null,
    pageUrls: occurrences.pageUrls ?? [],
    occurrenceCount: occurrences.count,
    visualUrl,
    truthLabel: deriveTruthLabel(flag.source, flag.checkId ?? null),
  }
}

export function buildLiveExplorerModel(input: {
  url: string
  pageType: string | null
  score: number | null
  flags: RankableFlag[]
  screenshots?: AuditScreenshot[]
  rubricRows: Array<{ name: string; score: number | null; grade?: string | null }>
  evidenceAnchors?: EvidenceAnchorMap
  previewMeta?: PreviewMeta | null
  flagVisualEvidence?: Record<string, { gifUrl?: string | null; overlayUrl?: string | null }>
  productContract?: ProductContract | null
  promptAccess?: 'all' | 'one' | 'none'
  demonstratedFlag?: RankableFlag | null
  fixList?: FixList
}): ReportExplorerModel {
  const fixList =
    input.fixList ??
    buildFixList({
      flags: input.flags,
      rubricRows: input.rubricRows.map((row) => ({
        name: row.name,
        grade: row.grade ?? null,
      })),
      url: input.url,
      contract: input.productContract ?? null,
      promptAccess: input.promptAccess ?? 'all',
      demonstratedFlag: input.demonstratedFlag,
    })
  const flagsById = new Map(input.flags.map((flag) => [flag.id, flag]))
  const sorted = fixList.items.flatMap((item) => {
    const flag =
      item.id === input.demonstratedFlag?.id
        ? input.demonstratedFlag
        : flagsById.get(item.id)
    return flag
      ? [
          {
            flag: {
              ...flag,
              checkId: item.checkId,
              problem: item.problem,
              evidence: item.evidence,
              pageUrl: item.pageUrl,
            },
            item,
          },
        ]
      : []
  })
  const promptVisibleById = new Map(
    fixList.items.map((item) => [item.id, item.prompt !== null])
  )
  const desktopScreenshot = input.screenshots?.find((s) => s.device === 'DESKTOP')?.url ?? null
  const mobileScreenshot = input.screenshots?.find((s) => s.device === 'MOBILE')?.url ?? null
  const desktop = desktopScreenshot ? normalizeInternalScreenshotUrl(desktopScreenshot) : null
  const mobile = mobileScreenshot ? normalizeInternalScreenshotUrl(mobileScreenshot) : null
  const displayHost = displayHostname(input.url)

  return {
    displayHost,
    pageType: input.pageType,
    score: input.score,
    flagCount: sorted.length,
    polishPassPrompt: fixList.copyPrompt,
    desktopScreenshot: desktop,
    mobileScreenshot: mobile,
    rubricScores: buildRubricScoreRows(input.rubricRows),
    flags: sorted.map(({ flag, item }) =>
      mapLiveFlag(
        flag,
        input.flagVisualEvidence,
        promptVisibleById.get(flag.id) ?? false,
        { pageUrls: item.pageUrls, count: item.occurrenceCount },
        fixList.copyPrompt ?? ''
      )
    ),
    allHighlights: buildAllEvidenceHighlights(
      sorted.map(({ flag }) => flag),
      input.evidenceAnchors
    ),
    previewMeta: input.previewMeta ?? null,
  }
}

export interface PartialExplorerFlag {
  id: string
  severity: string
  problem: string
  rubric: string
  checkId?: string | null
  source?: string | null
}

/** Build explorer model from in-progress status payload (empty flags still return chrome). */
export function buildPartialExplorerModel(input: {
  url: string
  pageType?: string | null
  score?: number | null
  flags: PartialExplorerFlag[]
  screenshots?: AuditScreenshot[]
  rubrics?: Array<{ name: string; score: number | null; grade?: string | null }>
}): ReportExplorerModel {
  const rankableFlags: RankableFlag[] = input.flags.map((flag) => ({
    id: flag.id,
    checkId: flag.checkId ?? null,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    source: flag.source ?? 'DETERMINISTIC',
  }))

  const rubricRows = RUBRIC_ORDER.map((name) => {
    const row = input.rubrics?.find((r) => r.name === name)
    return { name, score: row?.score ?? null, grade: row?.grade ?? null }
  })

  return buildLiveExplorerModel({
    url: input.url,
    pageType: input.pageType ?? null,
    score: input.score ?? null,
    flags: rankableFlags,
    screenshots: input.screenshots,
    rubricRows,
  })
}

function mapSampleFlag(flag: SampleFlagDisplay, mayShowPrompt: boolean): ExplorerFlag {
  return {
    id: flag.id,
    checkId: null,
    title: flag.title,
    rubric: flag.rubric,
    rubricLabel: flag.rubricLabel,
    severity: flag.severity,
    severityLabel: flag.severityLabel,
    impactTag: flag.impactTag,
    whyItMatters: flag.whyItMatters,
    evidence: flag.evidence,
    fixPrompt: mayShowPrompt ? flag.fixPrompt : '',
    copyFixPrompt: mayShowPrompt
      ? buildPlanModePrompt(
          [
            {
              id: flag.id,
              checkId: null,
              rubric: flag.rubric,
              severity: flag.severity,
              problem: flag.title,
              evidence: flag.evidence,
              fix: flag.fixPrompt,
            },
          ],
          { limit: 1 }
        )
      : '',
    toolPrompts: {},
    verificationRule: flag.verificationRule,
    affectedDevices: flag.affectedDevices,
    hasFixPrompt: mayShowPrompt && Boolean(flag.fixPrompt),
    pageUrl: flag.pageUrl ?? null,
    pageUrls: flag.pageUrl ? [flag.pageUrl] : [],
    occurrenceCount: 1,
    visualUrl: null,
    truthLabel: 'Detected',
  }
}

export function buildSampleExplorerModel(
  report: SampleReportDisplay,
  options: { promptAccess?: 'one' | 'all' | 'none' } = {}
): ReportExplorerModel {
  const promptAccess = options.promptAccess ?? 'one'
  return {
    displayHost: report.displayHost,
    pageType: report.pageType,
    score: report.score,
    flagCount: report.flagCount,
    polishPassPrompt: null,
    desktopScreenshot: report.desktopScreenshot,
    mobileScreenshot: report.mobileScreenshot,
    rubricScores: report.rubricScores,
    flags: report.flags.map((flag) =>
      mapSampleFlag(
        flag,
        promptAccess === 'all' ||
          (promptAccess === 'one' && flag.id === report.demonstratedFlagId)
      )
    ),
    allHighlights: report.flags.flatMap((f) => f.evidenceHighlights),
    previewMeta: null,
  }
}
