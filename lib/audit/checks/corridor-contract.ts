export const PUBLIC_PREVIEW_CHECK_VERSIONS = {
  'corridor-og-title-drift': 3,
  'corridor-og-description-drift': 2,
} as const

export const CORRIDOR_VERIFICATION_RULE = 'Cross-page preview comparison: repeat every original page pair under the same browser and access conditions.'
export const PUBLIC_CORRIDOR_VERIFICATION_RULE = 'Compare the public HTML head for every original page pair, including the same destinations after redirects.'

export function corridorVerificationSource(rule: string | null | undefined) {
  if (rule === PUBLIC_CORRIDOR_VERIFICATION_RULE) return 'http'
  if (rule === CORRIDOR_VERIFICATION_RULE) return 'rendered-dom'
}

export function corridorEvidenceSource(checks: Readonly<Record<string, number>> | undefined): 'http' | 'rendered-dom' {
  return Object.entries(PUBLIC_PREVIEW_CHECK_VERSIONS).some(([id, version]) => checks?.[id] === version) ? 'http' : 'rendered-dom'
}
