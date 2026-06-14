'use client'
import useSWR from 'swr'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'

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
  errorMsg?: string | null
  startedAt?: string | null
  completedAt?: string | null
  url: string
  isPublic?: boolean
  parentId?: string | null
  screenshots?: AuditScreenshot[]
  screenshotCapture?: ScreenshotCaptureStatus
  areas?: Array<{ name: string; grade: string; score: number | null }>
}

interface UseAuditPollingOptions {
  /** Server-rendered audit for terminal states — skips client fetch when complete. */
  initialAudit?: Record<string, unknown> | null
  /** When true, audit is in a non-terminal state and status polling is required. */
  pollStatus?: boolean
}

export function useAuditPolling(auditId: string, options: UseAuditPollingOptions = {}) {
  const { initialAudit, pollStatus = true } = options
  const initialTerminal =
    initialAudit?.status && TERMINAL_STATUSES.has(initialAudit.status as string)

  const { data: statusData, error: statusError, isLoading: statusLoading } = useSWR(
    pollStatus && !initialTerminal ? `/api/audits/${auditId}/status` : null,
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
  const isTerminal = TERMINAL_STATUSES.has(currentStatus)
  const needsFullFetch = isTerminal && !initialTerminal

  const { data: fullAudit, error: fullError, isLoading: fullLoading } = useSWR(
    needsFullFetch ? `/api/audits/${auditId}` : null,
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

  return {
    audit,
    isLoading,
    error,
    isComplete: currentStatus === 'COMPLETED',
    isFailed: currentStatus === 'FAILED',
    isNotFound: errStatus === 404,
    isForbidden: errStatus === 403,
    fetchError: error ? (error as Error).message : null,
    status: currentStatus,
    progress: (statusData?.progress ?? initialAudit?.progress ?? 0) as number,
    url: (statusData?.url ?? initialAudit?.url) as string | undefined,
    startedAt: (statusData?.startedAt ?? initialAudit?.startedAt) as string | null | undefined,
    statusPayload: statusData as AuditStatusPayload | undefined,
  }
}
