import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import {
  anchorToRegion,
  visualTargetLabel,
  type EvidenceRegionScope,
} from '@/lib/marketing/evidence-regions'
import {
  formatDisplayEvidence,
  buildExpertFixPrompt,
} from '@/lib/audit/flag-copy'

/** Normalized evidence region on a screenshot (0–1). */
export interface EvidenceHighlight {
  id: string
  flagId: string
  flagIndex: number
  device: 'desktop' | 'mobile'
  scope: EvidenceRegionScope
  x: number
  y: number
  width: number
  height: number
  label: string
  detail: string
  severity: string
  visualTarget: string
}

export function preferredDeviceForFlag(flag: RankableFlag): 'desktop' | 'mobile' {
  const checkId = flag.checkId ?? ''
  if (/mobile|thumb-zone|touch|375px|viewport-narrow/i.test(checkId)) return 'mobile'
  if (flag.rubric === 'EXPERIENCE') return 'mobile'
  return 'desktop'
}

export function formatFlagEvidence(flag: RankableFlag): string {
  return formatDisplayEvidence(flag.checkId, flag.evidence ?? flag.problem)
}

export function formatFlagFixPrompt(flag: RankableFlag): string {
  return buildExpertFixPrompt(flag)
}

function lookupAnchor(
  flag: RankableFlag,
  device: 'desktop' | 'mobile',
  anchorMap?: EvidenceAnchorMap
) {
  const key = flag.checkId ?? flag.id
  const entry = anchorMap?.[key]
  if (!entry) return null
  return entry[device] ?? null
}

export function buildEvidenceHighlightsForFlag(
  flag: RankableFlag,
  index: number,
  anchorMap?: EvidenceAnchorMap
): EvidenceHighlight[] {
  const key = flag.checkId ?? flag.id
  const preferred = preferredDeviceForFlag(flag)
  const devices = flag.checkId ? devicesForCheck(flag.checkId) : [preferred]
  const highlights: EvidenceHighlight[] = []
  const visualDetail = formatFlagEvidence(flag)

  for (const device of devices) {
    const anchor = lookupAnchor(flag, device, anchorMap)
    const region = anchorToRegion(key, anchor)
    highlights.push({
      id: `${flag.id}-${device}`,
      flagId: flag.id,
      flagIndex: index,
      device,
      scope: region.scope,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      label: flag.problem,
      detail: visualDetail,
      severity: flag.severity,
      visualTarget: flag.checkId ? visualTargetLabel(flag.checkId) : 'Flagged area',
    })
  }

  if (highlights.length > 0) return highlights

  return [
    {
      id: `${flag.id}-fallback`,
      flagId: flag.id,
      flagIndex: index,
      device: preferred,
      scope: 'page' as const,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      label: flag.problem,
      detail: `${visualDetail} Approximate area — exact element could not be pinned on the capture.`,
      severity: flag.severity,
      visualTarget: flag.checkId ? visualTargetLabel(flag.checkId) : 'Flagged area',
    },
  ]
}

export function buildAllEvidenceHighlights(
  flags: RankableFlag[],
  anchorMap?: EvidenceAnchorMap
): EvidenceHighlight[] {
  return flags.flatMap((flag, index) => buildEvidenceHighlightsForFlag(flag, index, anchorMap))
}

export function parseEvidenceAnchorsFromPerformanceData(
  performanceData: unknown
): EvidenceAnchorMap | undefined {
  if (!performanceData || typeof performanceData !== 'object') return undefined
  const anchors = (performanceData as Record<string, unknown>).evidenceAnchors
  if (!anchors || typeof anchors !== 'object') return undefined
  return anchors as EvidenceAnchorMap
}
