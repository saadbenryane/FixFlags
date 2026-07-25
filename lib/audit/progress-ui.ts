import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { PIPELINE_PROGRESS, PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'

export function statusToStageIndex(status: string): number {
  const idx = AUDIT_PROGRESS.stages.findIndex((s) => s.status === status)
  if (idx >= 0) return idx
  if (status === 'COMPLETED' || status === 'FAILED') return AUDIT_PROGRESS.stages.length
  return 0
}

export function getProgressPercent(progress: number | null | undefined, status: string): number {
  if (typeof progress === 'number' && progress > 0) return Math.min(100, progress)
  const fallback = PIPELINE_PROGRESS[status as keyof typeof PIPELINE_PROGRESS]
  return typeof fallback === 'number' ? fallback : PIPELINE_PROGRESS.QUEUED
}

/** Stage-based progress for UI (step N of total). */
export function getStageProgress(status: string): { current: number; total: number; percent: number } {
  const total = AUDIT_PROGRESS.stages.length
  const idx = statusToStageIndex(status)
  const current = status === 'COMPLETED' ? total : Math.min(idx + 1, total)
  const percent = Math.round((current / total) * 100)
  return { current, total, percent }
}

function resolveSubstepDetail(
  status: string,
  progress: number | null | undefined
): string | null {
  if (typeof progress !== 'number') return null
  const { substeps } = AUDIT_PROGRESS

  if (status === 'CAPTURING' && progress >= PIPELINE_PROGRESS_SUBSTEP.CAPTURE_DONE) {
    return substeps.CAPTURE_DONE
  }
  if (
    (status === 'CHECKING' || status === 'JUDGING') &&
    progress >= PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START &&
    progress < PIPELINE_PROGRESS.JUDGING
  ) {
    if (progress >= PIPELINE_PROGRESS_SUBSTEP.JOURNEY_DONE) return substeps.JOURNEY_DONE
    return substeps.JOURNEY_START
  }
  if (
    status === 'CHECKING' &&
    progress >= PIPELINE_PROGRESS_SUBSTEP.CHECKS_DONE &&
    progress < PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START
  ) {
    return substeps.CHECKS_DONE
  }
  return null
}

export type StagePresentation = {
  current: number
  total: number
  label: string
  /** Honest detail: real substep when progress crossed an anchor, else stage subtitle. */
  detail: string
  /** Hero badge text after "Scanning · ". */
  scanningLabel: string
  /** Mono status line: "Step N of 5 · {label}". */
  statusLine: string
  percent: number
}

/**
 * Single honest stage narrative for progressive UI.
 * Copy changes only when pipeline status or known progress substeps change, never on a timer.
 */
export function getStagePresentation(
  status: string,
  progress?: number | null
): StagePresentation {
  const { current, total } = getStageProgress(status)
  const stage =
    AUDIT_PROGRESS.stages.find((s) => s.status === status) ?? AUDIT_PROGRESS.stages[0]
  const substep = resolveSubstepDetail(status, progress)
  const detail = substep ?? stage.subtitle
  const percent = getProgressPercent(progress, status)

  return {
    current,
    total,
    label: stage.label,
    detail,
    scanningLabel: stage.label,
    statusLine: AUDIT_PROGRESS.formatStageStep(current, total, stage.label),
    percent,
  }
}

export function formatElapsedMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}
