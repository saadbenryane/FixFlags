import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { PIPELINE_VERSION } from './pipeline-config'
import { systemClock, type Clock } from '@/lib/time/clock'

export type PipelineEventStatus =
  | 'started'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'skipped'
  | 'info'

export interface ReviewExecutionTrace {
  executionId: string
  traceId: string
  attempt: number
}

export interface PipelineEventInput {
  stage: string
  event: string
  status?: PipelineEventStatus
  durationMs?: number
  error?: string
  detail?: string
}

export interface ReviewExecutionEventSink {
  log(event: PipelineEventInput): Promise<void>
}

export interface PipelineLogEvent {
  ts: string
  stage: string
  event: string
  status: PipelineEventStatus
  executionId?: string
  traceId?: string
  attempt?: number
  durationMs?: number
  error?: string
  detail?: string
}

type StoredPipelineEvent = {
  occurredAt: Date | string
  stage: string
  event: string
  status?: string
  executionId?: string
  traceId?: string
  attempt?: number
  durationMs?: number | null
  detail?: unknown
}

function sanitizeText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/\b(?:sk|key)-[a-zA-Z0-9_*-]{8,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

function eventStatus(event: string): PipelineEventStatus {
  if (event.includes('failed') || event.includes('error')) return 'failed'
  if (event.includes('skipped')) return 'skipped'
  if (event.includes('partial') || event.includes('degraded')) return 'partial'
  if (event.includes('started') || event.includes('starting')) return 'started'
  return 'completed'
}

function isPipelineEventStatus(value: unknown): value is PipelineEventStatus {
  return (
    value === 'started' ||
    value === 'completed' ||
    value === 'partial' ||
    value === 'failed' ||
    value === 'skipped' ||
    value === 'info'
  )
}

function textDetail(raw: unknown, key: 'error' | 'detail'): string | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const value = (raw as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function parsePipelineLog(raw: unknown): PipelineLogEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const value = item as Record<string, unknown>
    const stage = value.stage
    const event = value.event
    const timestamp = value.occurredAt ?? value.ts
    if (
      typeof stage !== 'string' ||
      typeof event !== 'string' ||
      !(typeof timestamp === 'string' || timestamp instanceof Date)
    ) return []

    const stored = item as StoredPipelineEvent
    return [{
      ts: new Date(timestamp).toISOString(),
      stage,
      event,
      status: isPipelineEventStatus(stored.status)
        ? stored.status
        : eventStatus(event),
      executionId: typeof stored.executionId === 'string' ? stored.executionId : undefined,
      traceId: typeof stored.traceId === 'string' ? stored.traceId : undefined,
      attempt: typeof stored.attempt === 'number' ? stored.attempt : undefined,
      durationMs: typeof stored.durationMs === 'number' ? stored.durationMs : undefined,
      error:
        textDetail(stored.detail, 'error') ??
        (typeof value.error === 'string' ? value.error : undefined),
      detail:
        textDetail(stored.detail, 'detail') ??
        (typeof value.detail === 'string' ? value.detail : undefined),
    }]
  })
}

async function latestExecution(auditId: string): Promise<ReviewExecutionTrace> {
  const latest = await prisma.auditPipelineEvent.findFirst({
    where: { auditId },
    orderBy: [{ attempt: 'desc' }, { occurredAt: 'desc' }],
    select: { executionId: true, traceId: true, attempt: true },
  })
  return latest ?? {
    executionId: `${auditId}:1`,
    traceId: auditId,
    attempt: 1,
  }
}

export async function listPipelineEvents(auditId: string): Promise<PipelineLogEvent[]> {
  const events = await prisma.auditPipelineEvent.findMany({
    where: { auditId },
    orderBy: [{ attempt: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
  })
  return parsePipelineLog(events)
}

export async function logPipelineEvent(
  auditId: string,
  event: PipelineEventInput,
  dependencies: { trace?: ReviewExecutionTrace; clock?: Clock } = {}
): Promise<void> {
  const trace = dependencies.trace ?? await latestExecution(auditId)
  const detail = {
    ...(event.error ? { error: sanitizeText(event.error) } : {}),
    ...(event.detail ? { detail: sanitizeText(event.detail) } : {}),
  }
  await prisma.auditPipelineEvent.create({
    data: {
      auditId,
      ...trace,
      stage: event.stage,
      event: event.event,
      status: event.status ?? eventStatus(event.event),
      durationMs: event.durationMs,
      detail: Object.keys(detail).length > 0
        ? detail as Prisma.InputJsonValue
        : undefined,
      occurredAt: (dependencies.clock ?? systemClock).now(),
    },
  })
}

export function createPipelineEventSink(
  auditId: string,
  trace: ReviewExecutionTrace,
  clock: Clock
): ReviewExecutionEventSink {
  return {
    log: (event) => logPipelineEvent(auditId, event, { trace, clock }),
  }
}

export async function initPipelineLog(
  auditId: string,
  dependencies: { traceId?: string; clock?: Clock } = {}
): Promise<ReviewExecutionTrace> {
  const clock = dependencies.clock ?? systemClock
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${`fixflags:pipeline:${auditId}`}, 0))
    `
    const latest = await tx.auditPipelineEvent.findFirst({
      where: { auditId },
      orderBy: { attempt: 'desc' },
      select: { attempt: true },
    })
    const attempt = (latest?.attempt ?? 0) + 1
    const trace: ReviewExecutionTrace = {
      executionId: `${auditId}:${attempt}`,
      traceId: dependencies.traceId ?? randomUUID(),
      attempt,
    }
    await tx.audit.update({
      where: { id: auditId },
      data: { pipelineVersion: PIPELINE_VERSION },
    })
    await tx.auditPipelineEvent.create({
      data: {
        auditId,
        ...trace,
        stage: 'queued',
        event: 'pipeline_started',
        status: 'started',
        occurredAt: clock.now(),
      },
    })
    return trace
  })
}
