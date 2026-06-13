export const AREA_ORDER = [
  'PERFORMANCE',
  'ACCESSIBILITY',
  'SEO',
  'CONVERSION',
  'TRUST',
  'CONTENT',
  'MOBILE',
] as const

export type AreaName = (typeof AREA_ORDER)[number]

export const AREA_NAMES = AREA_ORDER
