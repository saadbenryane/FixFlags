import { LeadStatus } from '@prisma/client'

export const LEAD_QUALIFY_MIN_SCANS = 2
export const LEAD_QUALIFY_MAX_SCORE = 70

export function shouldAutoQualifyLead(input: {
  status: LeadStatus
  scanCount: number
  latestScore: number | null | undefined
}): boolean {
  if (input.status !== 'NEW') return false
  if (input.scanCount >= LEAD_QUALIFY_MIN_SCANS) return true
  if (input.latestScore != null && input.latestScore < LEAD_QUALIFY_MAX_SCORE) return true
  return false
}
