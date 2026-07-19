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

/**
 * User-facing detail for the Scan step (page context, not internal pipeline
 * jargon). Never exposes the number of checks - we surface the page context or a
 * neutral label instead.
 */
export function reportScanDetail(pageType: string | null): string {
  if (pageType) return pageType
  return 'Full review'
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
      { id: 'prompts', label: 'Fix', detail: 'Fix prompts', state: 'pending' },
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
      detail: 'Fix prompts',
      state: fixesDone ? 'done' : 'pending',
    },
  ]
}

/** Fix-loop steps while an audit is still running (Scan → Flag → Fix). */
export function buildInProgressPipelineSteps(
  status: string,
  flagCount = 0
): PipelineStep[] {
  const scanDone = ['JUDGING', 'FINALIZING', 'COMPLETED'].includes(status)
  const flagActive = status === 'JUDGING'
  const flagDone = ['FINALIZING', 'COMPLETED'].includes(status)
  const fixActive = status === 'FINALIZING'
  const fixDone = status === 'COMPLETED'

  return [
    {
      id: 'scan',
      label: 'Scan',
      detail: scanDetail(null),
      state: scanDone ? 'done' : 'active',
    },
    {
      id: 'flags',
      label: 'Flag',
      detail: String(flagCount),
      state: flagDone ? 'done' : flagActive ? 'active' : 'pending',
    },
    {
      id: 'prompts',
      label: 'Fix',
      detail: 'Fix prompts',
      state: fixDone ? 'done' : fixActive ? 'active' : 'pending',
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
