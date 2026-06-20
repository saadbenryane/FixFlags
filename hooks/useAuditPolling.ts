'use client'
import useSWR from 'swr'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

async function jsonFetcher(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to load audit') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

export interface AuditStatusPayload {
  status: string
  progress: number
  score?: number | null
  pageType?: string | null
  verdict?: string | null
  errorMsg?: string | null
  failureCode?: string | null
  failureStage?: string | null
  failureMetadata?: Record<string, unknown> | null
  pipelineVersion?: string | null
  pipelineLog?: PipelineLogEvent[]
  reportCompleteness?: string | null
  startedAt?: string | null
  completedAt?: string | null
  url: string
  isPublic?: boolean
  parentId?: string | null
  screenshots?: AuditScreenshot[]
  screenshotCapture?: ScreenshotCaptureStatus
  rubrics?: Array<{ name: string; grade: string; score: number | null; status?: string | null }>
  flagCount?: number
  shareStatus?: string
  partialFlags?: Array<{ id: string; severity: string; problem: string; rubric: string }>
}

interface UseAuditPollingOptions {
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
}

export function useAuditPolling(auditId: string, options: UseAuditPollingOptions = {}) {
  const { initialAudit, pollStatus = true } = options
  const initialTerminal =
    initialAudit?.status && TERMINAL_STATUSES.has(initialAudit.status as string)

  const { data: statusData, error: statusError, isLoading: statusLoading } = useSWR(
    pollStatus && !initialTerminal ? `/api/reports/${auditId}/status` : null,
    jsonFetcher,
    {
      refreshInterval: (latest) => {
        if (!latest) return 2000
        if (TERMINAL_STATUSES.has(latest.status)) return 0
        return 2000
      },
      revalidateOnFocus: false,
    }
  )

  const currentStatus = (statusData?.status ?? initialAudit?.status ?? 'QUEUED') as string
  const isFailed = currentStatus === 'FAILED'
  const isComplete = currentStatus === 'COMPLETED'
  const needsFullFetch = isComplete && !initialTerminal

  const { data: fullAudit, error: fullError, isLoading: fullLoading } = useSWR(
    needsFullFetch ? `/api/reports/${auditId}` : null,
    jsonFetcher,
    { revalidateOnFocus: false }
  )

  const audit = initialTerminal
    ? initialAudit
    : needsFullFetch
      ? fullAudit
      : null

  const error = statusError ?? fullError
  const errStatus = (error as Error & { status?: number })?.status
  const isLoading =
    (!initialTerminal && pollStatus && statusLoading && !statusData) ||
    (needsFullFetch && fullLoading && !fullAudit)

  const statusPayload = statusData as AuditStatusPayload | undefined

  return {
    audit,
    isLoading,
    error,
    isComplete,
    isFailed,
    isNotFound: errStatus === 404,
    isForbidden: errStatus === 403,
    fetchError: error ? (error as Error).message : null,
    status: currentStatus,
    progress: (statusData?.progress ?? initialAudit?.progress ?? 0) as number,
    url: (statusData?.url ?? initialAudit?.url) as string | undefined,
    startedAt: (statusData?.startedAt ?? initialAudit?.startedAt) as string | null | undefined,
    statusPayload,
  }
}
