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

function captureStepDetail(pageType: string | null): string {
  if (pageType) return pageType
  return 'Landing page'
}

export function buildPipelineSteps({
  flagCount,
  pageType,
  mode = 'sample',
  hasFixPrompts,
  reviewReady,
}: {
  flagCount: number
  pageType: string | null
  mode?: PipelineStepsMode
  hasFixPrompts?: boolean
  reviewReady?: boolean
}): PipelineStep[] {
  const captureAndChecks: PipelineStep[] = [
    { id: 'capture', label: 'Site captured', detail: captureStepDetail(pageType), state: 'done' },
    {
      id: 'checks',
      label: 'Checks complete',
      detail: `${CHECK_ID_COUNT} checks`,
      state: 'done',
    },
  ]

  if (mode === 'sample') {
    return [
      ...captureAndChecks,
      {
        id: 'flags',
        label: 'Flags found',
        detail: String(flagCount),
        state: flagCount > 0 ? 'active' : 'done',
      },
      { id: 'prompts', label: 'Fix prompts ready', detail: 'Cursor-ready', state: 'pending' },
      { id: 'ready', label: 'Review ready', detail: 'After scoring', state: 'pending' },
    ]
  }

  const promptsDone = Boolean(hasFixPrompts)
  const readyDone = Boolean(reviewReady)

  return [
    ...captureAndChecks,
    {
      id: 'flags',
      label: 'Flags found',
      detail: String(flagCount),
      state: 'done',
    },
    {
      id: 'prompts',
      label: 'Fix prompts ready',
      detail: 'Cursor-ready',
      state: promptsDone ? 'done' : 'pending',
    },
    {
      id: 'ready',
      label: 'Review ready',
      detail: 'After scoring',
      state: readyDone ? 'done' : 'pending',
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
