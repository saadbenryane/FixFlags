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
} from '@/lib/audit/flag-copy'
import { parseEvidenceTargets } from '@/lib/audit/evidence-targets'
import { buildEditorHandoffPrompt } from '@/lib/audit/editor-handoff'

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
  measured: boolean
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
  return buildEditorHandoffPrompt(flag, { url: flag.pageUrl })
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
  const visualDetail = formatFlagEvidence(flag)
  const measured = highlightsFromTargets(flag, index, visualDetail)
  if (measured.length > 0) return measured

  // Curated sample fixtures may still supply measured DemoSite anchors.
  // Live Flags without evidenceTargets must not receive a guessed box.
  if (!anchorMap) return []

  const key = flag.checkId ?? flag.id
  const preferred = preferredDeviceForFlag(flag)
  const devices = flag.checkId ? devicesForCheck(flag.checkId) : [preferred]
  const highlights: EvidenceHighlight[] = []

  for (const device of devices) {
    const anchor = lookupAnchor(flag, device, anchorMap)
    if (!anchor) continue
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
      measured: region.scope === 'page' || Boolean(anchor.width && anchor.height),
    })
  }

  return highlights
}

function highlightsFromTargets(
  flag: RankableFlag,
  index: number,
  visualDetail: string
): EvidenceHighlight[] {
  const targets = parseEvidenceTargets(flag.evidenceTargets)
  return targets.map((target) => {
    if (target.kind === 'page') {
      return {
        id: `${flag.id}-${target.device}`,
        flagId: flag.id,
        flagIndex: index,
        device: target.device,
        scope: 'page' as const,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        label: flag.problem,
        detail: visualDetail,
        severity: flag.severity,
        visualTarget: target.label,
        measured: true,
      }
    }
    const rect = target.rect
    if (!rect) {
      return {
        id: `${flag.id}-${target.device}`,
        flagId: flag.id,
        flagIndex: index,
        device: target.device,
        scope: 'page' as const,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        label: flag.problem,
        detail: visualDetail,
        severity: flag.severity,
        visualTarget: target.label,
        measured: true,
      }
    }
    return {
      id: `${flag.id}-${target.device}`,
      flagId: flag.id,
      flagIndex: index,
      device: target.device,
      scope: 'element' as const,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      label: flag.problem,
      detail: visualDetail,
      severity: flag.severity,
      visualTarget: target.label,
      measured: true,
    }
  })
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
