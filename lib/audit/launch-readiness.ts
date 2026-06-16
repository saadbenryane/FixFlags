export type LaunchReadinessValue = 'safe' | 'fix_first' | 'not_ready' | 'unknown'

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
  if (
    readiness !== 'safe' &&
    readiness !== 'fix_first' &&
    readiness !== 'not_ready' &&
    readiness !== 'unknown'
  ) {
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
