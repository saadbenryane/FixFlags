import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel, rubricDescription } from '@/lib/utils'
import { rubricIcon } from '@/lib/rubric-icons'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { LucideIcon } from 'lucide-react'

export interface RubricOverviewRow {
  name: string
  label: string
  description: string
  icon: LucideIcon
  score: number | null
  /** `undefined` when not pending and the rubric has no computed status yet. */
  status: RubricComputed['status'] | 'SCANNING' | undefined
  flagCount: number
  criticalCount: number
  pending: boolean
}

/**
 * Single source for the per-rubric display data used by both `RubricBar`
 * (row layout) and `RubricSummaryGrid` (card layout). Previously each
 * re-derived the icon map, score lookup, and pending status independently.
 */
export function buildRubricOverview(
  rubrics: RubricComputed[],
  rubricRows: { name: string; score: number | null }[],
  loading = false,
): RubricOverviewRow[] {
  const scoreByName = new Map(rubricRows.map((row) => [row.name, row.score] as const))

  return RUBRIC_ORDER.map((name) => {
    const r = rubrics.find((x) => x.name === name)
    const score = scoreByName.get(name) ?? null
    const flagCount = r?.flagCount ?? 0
    const pending = loading && flagCount === 0 && score == null
    return {
      name,
      label: rubricLabel(name),
      description: rubricDescription(name),
      icon: rubricIcon(name),
      score,
      status: pending ? 'SCANNING' : r?.status,
      flagCount,
      criticalCount: r?.criticalCount ?? 0,
      pending,
    }
  })
}
