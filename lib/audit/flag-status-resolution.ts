import type { FlagStatus, Severity } from '@prisma/client'

const severityRank: Record<Severity, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  POLISH: 1,
}

export function resolveMonitoringFlagStatus(input: {
  parentStatus: FlagStatus
  parentSeverity: Severity
  monitoringSeverity: Severity
  stillFails: boolean
}): FlagStatus {
  if (!input.stillFails) return 'FIXED'
  if (input.parentStatus === 'FIXED') return 'REGRESSED'
  if (severityRank[input.monitoringSeverity] > severityRank[input.parentSeverity]) {
    return 'REGRESSED'
  }
  return 'OPEN'
}
