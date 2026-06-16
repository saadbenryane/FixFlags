import { prisma } from '@/lib/db'
import { PIPELINE_VERSION } from './pipeline-config'

export interface PipelineLogEvent {
  ts: string
  stage: string
  event: string
  durationMs?: number
  error?: string
  detail?: string
}

export function parsePipelineLog(raw: unknown): PipelineLogEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is PipelineLogEvent =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as PipelineLogEvent).ts === 'string' &&
      typeof (item as PipelineLogEvent).stage === 'string' &&
      typeof (item as PipelineLogEvent).event === 'string'
  )
}

export async function logPipelineEvent(
  auditId: string,
  event: {
    stage: string
    event: string
    durationMs?: number
    error?: string
    detail?: string
  }
): Promise<void> {
  const entry: PipelineLogEvent = {
    ts: new Date().toISOString(),
    stage: event.stage,
    event: event.event,
    durationMs: event.durationMs,
    error: event.error,
    detail: event.detail,
  }

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { pipelineLog: true },
  })
  const existing = parsePipelineLog(audit?.pipelineLog)

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      pipelineLog: [...existing, entry] as never,
      pipelineVersion: PIPELINE_VERSION,
    },
  })
}

export async function initPipelineLog(auditId: string): Promise<void> {
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      pipelineLog: [] as never,
      pipelineVersion: PIPELINE_VERSION,
    },
  })
  await logPipelineEvent(auditId, { stage: 'queued', event: 'pipeline_started' })
}
