import type { SiteCardArea } from '@/lib/sites/card-areas'

/** Decorative studio objects. Check labels and examples remain rendered text. */
export const CHECK_ARTWORK = {
  conversion: '/marketing/visuals/check-conversion-glass-v1.webp',
  site: '/marketing/visuals/check-pages-glass-v1.webp',
  security: '/marketing/visuals/check-security-glass-v1.webp',
  search: '/marketing/visuals/check-search-glass-v1.webp',
  performance: '/marketing/visuals/check-performance-glass-v1.webp',
  tracking: '/marketing/visuals/check-tracking-glass-v1.webp',
  accessibility: '/marketing/visuals/check-accessibility-glass-v1.webp',
  uptime: '/marketing/visuals/check-uptime-glass-v1.webp',
} as const satisfies Record<SiteCardArea, string>
