/** Derived outbound potential — not a LeadStatus enum value. */
export type LeadPotential = 'low' | 'medium' | 'high'

/**
 * Derive lead potential from signup + scan activity.
 * LOW: no signup + 1 scan (or fewer)
 * MEDIUM: no signup + 2+ scans
 * HIGH: signed up (linkedUserId set) + 1+ scans
 */
export function deriveLeadPotential(input: {
  linkedUserId: string | null | undefined
  scanCount: number
}): LeadPotential {
  if (input.linkedUserId && input.scanCount >= 1) return 'high'
  if (!input.linkedUserId && input.scanCount >= 2) return 'medium'
  return 'low'
}

export function formatLeadPotential(potential: LeadPotential): string {
  switch (potential) {
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    case 'low':
      return 'Low'
  }
}
