import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { gradeFromScore } from '@/lib/audit/scoring'
import { rubricLabel } from '@/lib/utils'

export type PipelineStepState = 'done' | 'active' | 'pending'

export interface PipelineStep {
  id: string
  label: string
  detail: string
  state: PipelineStepState
}

export interface RubricScoreRow {
  name: string
  score: number | null
  grade: string | null
}

export type PipelineStepsMode = 'sample' | 'audit'

/** User-facing detail for the Scan step (page context, not internal pipeline jargon). */
export function reportScanDetail(pageType: string | null): string {
  if (pageType) return pageType
  return `${CHECK_ID_COUNT} checks`
}

function scanDetail(pageType: string | null): string {
  return reportScanDetail(pageType)
}

/**
 * Value-driven progress aligned with the fix loop: Scan → Flag → Fix.
 * Capture/checks are collapsed into Scan; overall score lives in the ring, not a step.
 */
export function buildPipelineSteps({
  flagCount,
  pageType,
  mode = 'sample',
  hasFixPrompts,
}: {
  flagCount: number
  pageType: string | null
  mode?: PipelineStepsMode
  hasFixPrompts?: boolean
  /** @deprecated Score is shown in the ring; kept for call-site compatibility */
  reviewReady?: boolean
}): PipelineStep[] {
  const scan: PipelineStep = {
    id: 'scan',
    label: 'Scan',
    detail: scanDetail(pageType),
    state: 'done',
  }

  if (mode === 'sample') {
    return [
      scan,
      {
        id: 'flags',
        label: 'Flag',
        detail: String(flagCount),
        state: flagCount > 0 ? 'active' : 'done',
      },
      { id: 'prompts', label: 'Fix', detail: 'Copy-ready', state: 'pending' },
    ]
  }

  const fixesDone = Boolean(hasFixPrompts)

  return [
    scan,
    {
      id: 'flags',
      label: 'Flag',
      detail: String(flagCount),
      state: 'done',
    },
    {
      id: 'prompts',
      label: 'Fix',
      detail: 'Copy-ready',
      state: fixesDone ? 'done' : 'pending',
    },
  ]
}

export function buildRubricScoreRows(
  rubricRows: { name: string; score: number | null; grade?: string | null }[]
): RubricScoreRow[] {
  return RUBRIC_ORDER.map((name) => {
    const row = rubricRows.find((r) => r.name === name)
    const score = row?.score ?? null
    return {
      name: rubricLabel(name),
      score,
      grade: row?.grade ?? (score != null ? gradeFromScore(score) : null),
    }
  })
}
