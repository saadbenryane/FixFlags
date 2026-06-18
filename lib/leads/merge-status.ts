import { LeadStatus } from '@prisma/client'
import { shouldAutoQualifyLead } from '@/lib/leads/qualify'

/** Preserve manual workflow states when backfilling or re-syncing leads. */
export function mergeLeadStatusOnBackfill(input: {
  currentStatus: LeadStatus
  scanCount: number
  latestScore: number | null
}): LeadStatus {
  if (input.currentStatus !== 'NEW' && input.currentStatus !== 'QUALIFIED') {
    return input.currentStatus
  }

  return shouldAutoQualifyLead({
    status: 'NEW',
    scanCount: input.scanCount,
    latestScore: input.latestScore,
  })
    ? 'QUALIFIED'
    : 'NEW'
}
