import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

const STATUS_PROGRESS_FALLBACK: Record<string, number> = {
  QUEUED: 5,
  CAPTURING: 12,
  CHECKING: 50,
  JUDGING: 85,
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

/** Value-focused activity line — client-only, not tied to backend modules. */
export function getActivityMessage(progress: number, tick: number): string {
  const messages = AUDIT_PROGRESS.activity
  const bandSize = 100 / messages.length
  const bandIndex = Math.min(messages.length - 1, Math.floor(progress / bandSize))
  const rotate = tick % 3
  const index = (bandIndex + rotate) % messages.length
  return messages[index]
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
