export type LaunchReadinessValue = 'safe' | 'fix_first' | 'not_ready'

export interface LaunchChecklistItem {
  id: string
  label: string
  passed: boolean
}

export interface LaunchReadinessData {
  readiness: LaunchReadinessValue
  checklist: LaunchChecklistItem[]
}

export function parseLaunchReadiness(raw: unknown): LaunchReadinessData | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const readiness = obj.readiness
  if (readiness !== 'safe' && readiness !== 'fix_first' && readiness !== 'not_ready') {
    return null
  }
  const checklistRaw = obj.checklist
  const checklist: LaunchChecklistItem[] = Array.isArray(checklistRaw)
    ? checklistRaw
        .filter(
          (item): item is LaunchChecklistItem =>
            item &&
            typeof item === 'object' &&
            typeof (item as LaunchChecklistItem).id === 'string' &&
            typeof (item as LaunchChecklistItem).label === 'string' &&
            typeof (item as LaunchChecklistItem).passed === 'boolean'
        )
    : []
  return { readiness, checklist }
}

export function launchReadinessLabel(readiness: LaunchReadinessValue): string {
  switch (readiness) {
    case 'safe':
      return 'Ready to launch'
    case 'fix_first':
      return 'Fix first'
    case 'not_ready':
      return 'Not ready'
  }
}

export function launchReadinessTone(readiness: LaunchReadinessValue): string {
  switch (readiness) {
    case 'safe':
      return 'text-grade-A bg-grade-A/10 border-grade-A/25'
    case 'fix_first':
      return 'text-grade-C bg-grade-C/10 border-grade-C/25'
    case 'not_ready':
      return 'text-grade-F bg-grade-F/10 border-grade-F/25'
  }
}
