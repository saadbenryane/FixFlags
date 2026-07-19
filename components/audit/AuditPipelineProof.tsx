import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import { durationFromTimestamps } from '@/lib/audit/duration'

interface Props {
  pipelineVersion?: string | null
  pipelineLog?: PipelineLogEvent[] | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  durationMs?: number | null
}

export function AuditPipelineProof({
  pipelineLog,
  startedAt,
  completedAt,
  durationMs,
}: Props) {
  const events = pipelineLog ?? []

  const captureEvent = events.find((e) => e.event === 'capture_completed')
  const judgeEvent = events.find((e) => e.event === 'judge_completed' || e.event === 'judge_completed_retry')

  const durationSec = durationFromTimestamps(durationMs, startedAt, completedAt)

  const parts: string[] = []
  if (durationSec != null) parts.push(`Audited in ${durationSec}s`)
  if (captureEvent?.ts) {
    const t = new Date(captureEvent.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    parts.push(`Captured ${t}`)
  }
  if (judgeEvent?.ts) {
    const t = new Date(judgeEvent.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    parts.push(`AI review ${t}`)
  }

  if (parts.length === 0) return null

  return (
    <p className="text-xs text-muted-foreground font-mono tabular-nums">
      {parts.join(' · ')}
    </p>
  )
}
