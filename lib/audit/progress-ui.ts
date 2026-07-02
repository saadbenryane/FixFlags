import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

const STATUS_PROGRESS_FALLBACK: Record<string, number> = {
  QUEUED: 5,
  CAPTURING: 20,
  CHECKING: 40,
  JUDGING: 70,
  FINALIZING: 90,
  COMPLETED: 100,
  FAILED: 0,
}

export function statusToStageIndex(status: string): number {
  const idx = AUDIT_PROGRESS.stages.findIndex((s) => s.status === status)
  if (idx >= 0) return idx
  if (status === 'COMPLETED' || status === 'FAILED') return AUDIT_PROGRESS.stages.length
  return 0
}

export function getProgressPercent(progress: number | null | undefined, status: string): number {
  if (typeof progress === 'number' && progress > 0) return Math.min(100, progress)
  return STATUS_PROGRESS_FALLBACK[status] ?? 5
}

/** Stage-based progress for UI (step N of total). */
export function getStageProgress(status: string): { current: number; total: number; percent: number } {
  const total = AUDIT_PROGRESS.stages.length
  const idx = statusToStageIndex(status)
  const current = status === 'COMPLETED' ? total : Math.min(idx + 1, total)
  const percent = Math.round((current / total) * 100)
  return { current, total, percent }
}

export function getActivityMessage(status: string, tick: number): string {
  const messages =
    AUDIT_PROGRESS.stageActivity[status as keyof typeof AUDIT_PROGRESS.stageActivity] ??
  AUDIT_PROGRESS.stageActivity.CHECKING
  return messages[tick % messages.length]
}

/**
 * Short, value-framed subcategory labels shown inline next to "Scanning ·".
 * Deliberately reveals no check counts or the exact recipe - just the area of
 * the review currently in focus. Keyed by pipeline stage so it tracks reality.
 */
const SCAN_PHASE_LABELS: Record<string, string[]> = {
  QUEUED: ['Starting your review'],
  CAPTURING: ['Loading your page', 'Capturing desktop & mobile'],
  CHECKING: [
    'Analyzing message clarity',
    'Checking your calls to action',
    'Reviewing mobile experience',
    'Measuring load speed',
    'Checking share previews',
    'Reviewing trust signals',
  ],
  JUDGING: ['Turning issues into flags', 'Prioritizing by launch impact'],
  FINALIZING: ['Packaging your review'],
}

/** Rotating subcategory label for the in-progress "Scanning · …" line. */
export function getScanningLabel(status: string, tick: number): string {
  const labels = SCAN_PHASE_LABELS[status] ?? SCAN_PHASE_LABELS.CHECKING
  return labels[tick % labels.length]
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

export function truncateUrl(url: string, max = 48): string {
  try {
    const parsed = new URL(url)
    const display = parsed.hostname + parsed.pathname
    if (display.length <= max) return display
    return display.slice(0, max - 1) + '…'
  } catch {
    if (url.length <= max) return url
    return url.slice(0, max - 1) + '…'
  }
}
