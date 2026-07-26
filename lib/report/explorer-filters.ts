import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import type { ExplorerFlag } from '@/lib/report/explorer-model'

export type RubricFilter = 'ALL' | RubricName

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
    pageFilter?: string | null
    severityFilter?: string | null
    impactFilter?: string | null
  } = {}
): Record<RubricName, number> {
  const counts = { MESSAGE: 0, EXPERIENCE: 0, REACH: 0 } as Record<RubricName, number>
  const pageFilter = options.pageFilter ?? null
  const severityFilter = options.severityFilter ?? null
  const impactFilter = options.impactFilter ?? null

  for (const flag of flags) {
    if (pageFilter && !flag.pageUrls.includes(pageFilter)) continue
    if (severityFilter && flag.severity !== severityFilter) continue
    if (impactFilter && flag.impactTag !== impactFilter) continue
    if (flag.rubric in counts) {
      counts[flag.rubric as RubricName] += 1
    }
  }
  return counts
}

export function filterExplorerFlags(
  flags: ExplorerFlag[],
  options: {
    rubricFilter?: RubricFilter
    pageFilter?: string | null
    severityFilter?: string | null
    impactFilter?: string | null
  } = {}
): ExplorerFlag[] {
  const rubricFilter = options.rubricFilter ?? 'ALL'
  const pageFilter = options.pageFilter ?? null
  const severityFilter = options.severityFilter ?? null
  const impactFilter = options.impactFilter ?? null

  return flags.filter((flag) => {
    if (rubricFilter !== 'ALL' && flag.rubric !== rubricFilter) return false
    if (pageFilter && !flag.pageUrls.includes(pageFilter)) return false
    if (severityFilter && flag.severity !== severityFilter) return false
    if (impactFilter && flag.impactTag !== impactFilter) return false
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

export function initialExplorerFlagIndex(
  flags: ExplorerFlag[],
  requestedIndex: number,
  demonstratedFlagId?: string | null
): number {
  if (demonstratedFlagId) {
    const demonstratedIndex = flags.findIndex((flag) => flag.id === demonstratedFlagId)
    if (demonstratedIndex >= 0) return demonstratedIndex
  }
  return clampFlagIndex(requestedIndex, flags.length)
}

export { RUBRIC_ORDER }
