import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'

export interface NormalizedPoint {
  x: number
  y: number
}

export interface NormalizedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LetterboxLayout {
  /** Fraction of container width used by the fitted image. */
  scale: number
  /** Left offset as fraction of container width (0–1). */
  offsetX: number
  /** Top offset as fraction of container height (0–1). */
  offsetY: number
}

/** object-contain layout for a capture fitted inside its frame. */
export function computeLetterboxLayout(
  imageAspect: number,
  containerAspect: number
): LetterboxLayout {
  if (!Number.isFinite(imageAspect) || imageAspect <= 0) {
    return { scale: 1, offsetX: 0, offsetY: 0 }
  }
  if (imageAspect > containerAspect) {
    const scale = containerAspect / imageAspect
    return { scale: 1, offsetX: 0, offsetY: (1 - scale) / 2 }
  }
  const scale = imageAspect / containerAspect
  return { scale, offsetX: (1 - scale) / 2, offsetY: 0 }
}

/** Map normalized capture coords (0–1) into the letterboxed image area. */
export function mapHighlightToLetterbox(
  highlight: Pick<EvidenceHighlight, 'x' | 'y' | 'width' | 'height'>,
  layout: LetterboxLayout
): NormalizedRect {
  const { scale, offsetX, offsetY } = layout
  return {
    x: offsetX + highlight.x * scale,
    y: offsetY + highlight.y * scale,
    width: highlight.width * scale,
    height: highlight.height * scale,
  }
}

export function highlightCenter(
  highlight: Pick<EvidenceHighlight, 'x' | 'y' | 'width' | 'height'>,
  layout?: LetterboxLayout
): NormalizedPoint {
  const rect = layout ? mapHighlightToLetterbox(highlight, layout) : highlight
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
}

export function normalizedPercent(value: number): string {
  return `${value * 100}%`
}
