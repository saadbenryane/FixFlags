import { LeadStatus } from '@prisma/client'

/**
 * Preserve manual workflow states when backfilling or re-syncing leads.
 * Never auto-promote to QUALIFIED — potential is derived at read time.
 */
export function mergeLeadStatusOnBackfill(input: {
  currentStatus: LeadStatus
  /** @deprecated unused — kept for call-site compatibility during transition */
  scanCount?: number
  /** @deprecated unused — kept for call-site compatibility during transition */
  latestScore?: number | null
}): LeadStatus {
  // Preserve any non-NEW status (manual workflow or legacy QUALIFIED rows).
  if (input.currentStatus !== 'NEW') {
    return input.currentStatus
  }
  return 'NEW'
}
