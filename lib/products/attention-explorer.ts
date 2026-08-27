import { buildPlanModePrompt, type RankableFlag } from '@/lib/audit/priority-flags'
import { buildAllEvidenceHighlights } from '@/lib/audit/evidence-highlights'
import type { FlagVisualEvidenceMap } from '@/lib/audit/persist-visual-evidence'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import type {
  ProductAttentionEvidenceDTO,
  ProductAttentionItemDTO,
} from '@/lib/products/workspace'
import {
  deriveTruthLabel,
  type ExplorerFlag,
  type ReportExplorerModel,
} from '@/lib/report/explorer-model'
import { rubricLabel, severityLabel } from '@/lib/utils'

function pageUrlsForItem(item: ProductAttentionItemDTO): string[] {
  if (item.pageUrls.length > 0) return item.pageUrls
  return item.pageUrl ? [item.pageUrl] : []
}

function visualForCheck(
  checkId: string | null,
  visuals?: FlagVisualEvidenceMap
): Pick<ExplorerFlag, 'visualUrl' | 'visualDevice' | 'visualType'> {
  if (!checkId || !visuals) return {}
  const visual = visuals[checkId]
  if (!visual) return {}
  const visualUrl =
    visual.type === 'side-by-side'
      ? null
      : visual.gifUrl || visual.overlayUrl || null
  if (!visualUrl) return {}
  return {
    visualUrl,
    visualDevice: visual.device,
    visualType: visual.type,
  }
}

/** Project a Product attention item into the shared report Flag shape. */
export function attentionItemToExplorerFlag(
  item: ProductAttentionItemDTO,
  visuals?: FlagVisualEvidenceMap
): ExplorerFlag {
  const severity = item.severity ?? 'IMPORTANT'
  const rubric = item.rubric ?? 'EXPERIENCE'
  const prompt = item.prompt?.trim() ?? ''
  const pageUrls = pageUrlsForItem(item)
  return {
    id: item.sourceFlagId ?? item.id,
    checkId: item.checkId,
    title: item.title,
    rubric,
    rubricLabel: rubricLabel(rubric),
    severity,
    severityLabel: severityLabel(severity),
    impactTag: item.impactTag,
    whyItMatters: item.judgment,
    evidence: item.evidence ?? '',
    fixPrompt: prompt,
    copyFixPrompt: prompt,
    toolPrompts: {},
    verificationRule: item.successCondition || null,
    affectedDevices: item.checkId
      ? devicesForCheck(item.checkId)
      : [rubric === 'EXPERIENCE' ? 'mobile' : 'desktop'],
    hasFixPrompt: Boolean(prompt),
    pageUrl: item.pageUrl,
    pageUrls,
    occurrenceCount: Math.max(pageUrls.length, 1),
    truthLabel: deriveTruthLabel(item.source, item.checkId),
    ...visualForCheck(item.checkId, visuals),
  }
}

function rankableFromAttentionItem(item: ProductAttentionItemDTO): RankableFlag {
  const prompt = item.prompt?.trim() || null
  return {
    id: item.sourceFlagId ?? item.id,
    rubric: item.rubric ?? 'EXPERIENCE',
    severity: item.severity ?? 'IMPORTANT',
    problem: item.title,
    checkId: item.checkId ?? undefined,
    pageUrl: item.pageUrl ?? undefined,
    evidenceTargets: item.evidenceTargets,
    // Editor handoff already built on the Product DTO; feed plan-mode as agentPrompt.
    agentPrompt: prompt,
  }
}

export type AttentionExplorerOptions = {
  /** Canonical Product URL for the aggregate Copy All bundle header. */
  url?: string | null
}

/** Build a report explorer model for Product Your priorities. */
export function buildAttentionExplorerModel(
  items: ProductAttentionItemDTO[],
  evidence: Record<string, ProductAttentionEvidenceDTO> = {},
  options: AttentionExplorerOptions = {}
): ReportExplorerModel {
  const flags = items.map((item) =>
    attentionItemToExplorerFlag(
      item,
      item.sourceReviewId ? evidence[item.sourceReviewId]?.visuals : undefined
    )
  )

  const capturesByFlagId: NonNullable<ReportExplorerModel['capturesByFlagId']> =
    {}
  const displayHostByFlagId: NonNullable<
    ReportExplorerModel['displayHostByFlagId']
  > = {}

  for (const item of items) {
    const flagId = item.sourceFlagId ?? item.id
    const reviewEvidence = item.sourceReviewId
      ? evidence[item.sourceReviewId]
      : undefined
    if (reviewEvidence) {
      capturesByFlagId[flagId] = {
        desktopScreenshot: reviewEvidence.desktopScreenshot,
        mobileScreenshot: reviewEvidence.mobileScreenshot,
      }
      displayHostByFlagId[flagId] = reviewEvidence.displayHost
    }
  }

  const firstFlagId = flags[0]?.id
  const firstEvidence =
    firstFlagId && capturesByFlagId[firstFlagId]
      ? {
          desktopScreenshot: capturesByFlagId[firstFlagId]!.desktopScreenshot,
          mobileScreenshot: capturesByFlagId[firstFlagId]!.mobileScreenshot,
          displayHost: displayHostByFlagId[firstFlagId] ?? '',
        }
      : null

  const rankables = items.map(rankableFromAttentionItem)
  const polishPassPrompt =
    buildPlanModePrompt(rankables, {
      url: options.url,
      limit: rankables.length,
    }) || null

  return {
    displayHost: firstEvidence?.displayHost ?? '',
    pageType: null,
    score: null,
    flagCount: flags.length,
    polishPassPrompt,
    desktopScreenshot: firstEvidence?.desktopScreenshot ?? null,
    mobileScreenshot: firstEvidence?.mobileScreenshot ?? null,
    rubricScores: [],
    flags,
    allHighlights: buildAllEvidenceHighlights(rankables),
    previewMeta: null,
    coverageSentence: null,
    capturesByFlagId,
    displayHostByFlagId,
  }
}
