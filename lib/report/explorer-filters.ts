import { isAttentionCandidate } from '@/lib/audit/attention'
import { type RubricName } from '@/lib/audit/constants'
import type { ExplorerFlag } from '@/lib/report/explorer-model'

export function firstAttentionFlagIndex(flags: ExplorerFlag[]): number {
  const index = flags.findIndex((flag) => isAttentionCandidate(flag))
  return index >= 0 ? index : 0
}

export type RubricFilter = 'ALL' | RubricName

export function countFlagsByRubric(flags: ExplorerFlag[]): Record<RubricName, number> {
  const counts = { MESSAGE: 0, EXPERIENCE: 0, REACH: 0 } as Record<RubricName, number>
  for (const flag of flags) {
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
  } = {}
): ExplorerFlag[] {
  const rubricFilter = options.rubricFilter ?? 'ALL'
  return flags.filter((flag) => {
    if (rubricFilter !== 'ALL' && flag.rubric !== rubricFilter) return false
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
  demonstratedFlagId?: string
): number {
  if (demonstratedFlagId) {
    const demonstrated = flags.findIndex((flag) => flag.id === demonstratedFlagId)
    if (demonstrated >= 0) return demonstrated
  }
  if (requestedIndex !== 0) return clampFlagIndex(requestedIndex, flags.length)
  return clampFlagIndex(firstAttentionFlagIndex(flags), flags.length)
}
