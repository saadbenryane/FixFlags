export const RUBRIC_ORDER = ['MESSAGE', 'EXPERIENCE', 'REACH'] as const

export type RubricName = (typeof RUBRIC_ORDER)[number]

export const RUBRIC_NAMES = RUBRIC_ORDER

export const IMPACT_TAG_ORDER = [
  'CONVERSION',
  'REVENUE',
  'TRUST',
  'MEASUREMENT',
  'SHARING',
  'SEO',
  'ACCESSIBILITY',
] as const

export type ImpactTagName = (typeof IMPACT_TAG_ORDER)[number]

export const SEVERITY_ORDER = ['CRITICAL', 'IMPORTANT', 'POLISH'] as const

export type SeverityName = (typeof SEVERITY_ORDER)[number]

export const FLAG_STATUS_ORDER = ['OPEN', 'FIXED', 'IGNORED', 'REGRESSED'] as const

export type FlagStatusName = (typeof FLAG_STATUS_ORDER)[number]
