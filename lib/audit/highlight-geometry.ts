import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'

export interface NormalizedPoint {
  x: number
  y: number
}

export function highlightCenter(
  highlight: Pick<EvidenceHighlight, 'x' | 'y' | 'width' | 'height'>
): NormalizedPoint {
  return {
    x: highlight.x + highlight.width / 2,
    y: highlight.y + highlight.height / 2,
  }
}

export function normalizedPercent(value: number): string {
  return `${value * 100}%`
}
