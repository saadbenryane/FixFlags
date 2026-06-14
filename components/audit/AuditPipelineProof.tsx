import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'

interface Props {
  pipelineVersion?: string | null
  pipelineLog?: PipelineLogEvent[] | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  durationMs?: number | null
}

export function AuditPipelineProof({
  pipelineVersion,
  pipelineLog,
  startedAt,
  completedAt,
  durationMs,
}: Props) {
  const version = pipelineVersion ?? PIPELINE_VERSION
  const events = pipelineLog ?? []

  const captureEvent = events.find((e) => e.event === 'capture_completed')
  const judgeEvent = events.find((e) => e.event === 'judge_completed' || e.event === 'judge_completed_retry')

  const durationSec =
    durationMs != null
      ? Math.round(durationMs / 1000)
      : startedAt && completedAt
        ? Math.round(
            (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
          )
        : null

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
  parts.push(`Pipeline v${version}`)

  if (parts.length <= 1) return null

  return (
    <p className="text-xs text-muted-foreground font-mono tabular-nums">
      {parts.join(' · ')}
    </p>
  )
}
