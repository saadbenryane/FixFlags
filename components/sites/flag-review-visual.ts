import { FileCode2, Image, Layers, PanelTop, Timer, type LucideIcon } from 'lucide-react'
import { BOARD_CARD_ICONS } from './BoardCard'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { canonicalHistoricalCheckId } from '@/lib/audit/check-compatibility'

/** Presentation identities use registered check IDs, never customer wording. */
export const FLAG_REVIEW_VISUALS: Record<string, { icon: LucideIcon; device: 'mobile' | 'desktop' }> = {
  'perf-score-critical': { icon: BOARD_CARD_ICONS.performance, device: 'desktop' },
  'perf-score-poor': { icon: BOARD_CARD_ICONS.performance, device: 'desktop' },
  'mobile-perf-critical': { icon: BOARD_CARD_ICONS.performance, device: 'mobile' },
  'mobile-perf-poor': { icon: BOARD_CARD_ICONS.performance, device: 'mobile' },
  'unoptimized-images': { icon: Image, device: 'desktop' },
  'mobile-unoptimized-images': { icon: Image, device: 'mobile' },
  'unused-js-large': { icon: FileCode2, device: 'desktop' },
  'mobile-unused-js-large': { icon: FileCode2, device: 'mobile' },
  'unused-css-large': { icon: FileCode2, device: 'desktop' },
  'mobile-unused-css-large': { icon: FileCode2, device: 'mobile' },
  'lcp-critical': { icon: Timer, device: 'desktop' },
  'lcp-poor': { icon: Timer, device: 'desktop' },
  'mobile-lcp-critical': { icon: Timer, device: 'mobile' },
  'mobile-lcp-poor': { icon: Timer, device: 'mobile' },
  'render-blocking': { icon: Layers, device: 'desktop' },
  'mobile-render-blocking': { icon: Layers, device: 'mobile' },
  'flow-mobile-menu-broken': { icon: PanelTop, device: 'mobile' },
}

export function flagReviewVisual(area: SiteCardArea, checkId?: string | null) {
  return FLAG_REVIEW_VISUALS[canonicalHistoricalCheckId(checkId)] ?? { icon: BOARD_CARD_ICONS[area], device: null }
}
