import type { FlagStatus, Severity } from '@prisma/client'
import { severityRank } from '@/lib/utils'

export function resolveMonitoringFlagStatus(input: {
  parentStatus: FlagStatus
  parentSeverity: Severity
  monitoringSeverity: Severity
  stillFails: boolean
}): FlagStatus {
  if (!input.stillFails) return 'FIXED'
  if (input.parentStatus === 'FIXED') return 'REGRESSED'
  if (severityRank(input.monitoringSeverity) < severityRank(input.parentSeverity)) {
    return 'REGRESSED'
  }
  return 'OPEN'
}
