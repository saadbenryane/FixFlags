import type { EvidenceAnchor } from '@/lib/marketing/resolve-evidence-anchors'
import type { FlowScanStatus } from './run-flow-scan'

const ANCHOR_CLAMP_MIN = 0.02
const ANCHOR_CLAMP_MAX = 0.98

/** Map flow scan status to the deterministic check id that would fire. */
export function flowCheckIdForStatus(status: FlowScanStatus): string | null {
  switch (status) {
    case 'no_cta':
      return 'flow-no-cta-found'
    case 'unclickable':
      return 'flow-cta-unclickable'
    case 'error_response':
      return 'flow-cta-404'
    case 'dead_end':
      return 'flow-cta-dead-end'
    case 'external_leave':
      return 'flow-cta-external-leave'
    default:
      return null
  }
}

/** Normalize an element bounding box to screenshot coordinates (0–1). */
export function anchorFromViewportRect(
  rect: { left: number; top: number; right: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number
): EvidenceAnchor | null {
  if (viewportWidth <= 0 || viewportHeight <= 0) return null
  if (rect.right <= rect.left || rect.bottom <= rect.top) return null

  const widthPx = rect.right - rect.left
  const heightPx = rect.bottom - rect.top
  const padX = Math.min(widthPx * 0.08, 12)
  const padY = Math.min(heightPx * 0.12, 10)
  const left = Math.max(0, rect.left - padX)
  const top = Math.max(0, rect.top - padY)
  const right = Math.min(viewportWidth, rect.right + padX)
  const bottom = Math.min(viewportHeight, rect.bottom + padY)

  const width = (right - left) / viewportWidth
  const height = (bottom - top) / viewportHeight
  const x = (left + (right - left) / 2) / viewportWidth
  const y = (top + (bottom - top) / 2) / viewportHeight

  return {
    x: Math.min(ANCHOR_CLAMP_MAX, Math.max(ANCHOR_CLAMP_MIN, x)),
    y: Math.min(ANCHOR_CLAMP_MAX, Math.max(ANCHOR_CLAMP_MIN, y)),
    width: Math.min(1, Math.max(0.06, width)),
    height: Math.min(1, Math.max(0.05, height)),
    scope: 'element',
  }
}
