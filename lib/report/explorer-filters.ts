import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import type { ExplorerFlag } from '@/lib/report/explorer-model'

export type SeverityFilter = 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'POLISH'
export type RubricFilter = 'ALL' | RubricName

export function priorityLabelForIndex(index: number): string {
  if (index === 0) return 'Fix first'
  if (index === 1) return 'Next'
  return `Priority ${index + 1}`
}

export function pageFilterLabel(url: string, role: string): string {
  try {
    const pathname = new URL(url).pathname
    if (pathname === '/' || pathname === '') return role
    const segment = pathname.split('/').filter(Boolean)[0] ?? ''
    return segment || role
  } catch {
    return role
  }
}

export function countFlagsByRubric(
  flags: ExplorerFlag[],
  options: {
    severityFilter?: SeverityFilter
    pageFilter?: string | null
  } = {}
): Record<RubricName, number> {
  const counts = { MESSAGE: 0, EXPERIENCE: 0, REACH: 0 } as Record<RubricName, number>
  const severityFilter = options.severityFilter ?? 'ALL'
  const pageFilter = options.pageFilter ?? null

  for (const flag of flags) {
    if (severityFilter !== 'ALL' && flag.severity !== severityFilter) continue
    if (pageFilter && flag.pageUrl !== pageFilter) continue
    if (flag.rubric in counts) {
      counts[flag.rubric as RubricName] += 1
    }
  }
  return counts
}

export function filterExplorerFlags(
  flags: ExplorerFlag[],
  options: {
    severityFilter?: SeverityFilter
    rubricFilter?: RubricFilter
    pageFilter?: string | null
  } = {}
): ExplorerFlag[] {
  const severityFilter = options.severityFilter ?? 'ALL'
  const rubricFilter = options.rubricFilter ?? 'ALL'
  const pageFilter = options.pageFilter ?? null

  return flags.filter((flag) => {
    if (severityFilter !== 'ALL' && flag.severity !== severityFilter) return false
    if (rubricFilter !== 'ALL' && flag.rubric !== rubricFilter) return false
    if (pageFilter && flag.pageUrl !== pageFilter) return false
    return true
  })
}

export function resolveRubricFilter(
  current: RubricFilter,
  counts: Record<RubricName, number>
): RubricFilter {
  if (current === 'ALL') return 'ALL'
  if (counts[current] === 0) return 'ALL'
  return current
}

export function clampFlagIndex(index: number, flagCount: number): number {
  if (flagCount <= 0) return 0
  if (index < 0) return 0
  if (index >= flagCount) return 0
  return index
}

export { RUBRIC_ORDER }
