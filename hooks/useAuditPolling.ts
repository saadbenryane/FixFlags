'use client'
import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'

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
  progressDetail?: string | null
  score?: number | null
  pageType?: string | null
  verdict?: string | null
  errorMsg?: string | null
  failureCode?: string | null
  pipelineVersion?: string | null
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
  partialFlags?: Array<{
    id: string
    severity: string
    problem: string
    rubric: string
    checkId?: string | null
    source?: string | null
    pageUrl?: string | null
  }>
  actionTimeline?: import('@/lib/audit/action-timeline').ActionTimelineEvent[]
  productContract?: import('@/lib/audit/product-contract').ProductContract | null
  technologyProfile?: import('@/lib/audit/technology-profile').TechnologyProfile
  agentMessages?: import('@/lib/audit/agent-message').AgentMessage[]
  pages?: Array<{
    url: string
    status: string
    role?: string | null
    position: number
  }>
}

interface UseAuditPollingOptions {
  initialAudit?: Record<string, unknown> | null
  pollStatus?: boolean
}

function pollIntervalMs(latest: AuditStatusPayload | undefined): number {
  if (!latest) return 1500
  if (TERMINAL_STATUSES.has(latest.status)) return 0
  const progress = typeof latest.progress === 'number' ? latest.progress : 0
  // Faster early (queue/capture feedback), back off while long-running stages work.
  if (progress < 25) return 1500
  if (progress < 70) return 2500
  return 3500
}

export function progressivePayloadFingerprint(value: AuditStatusPayload): string {
  return JSON.stringify({
    status: value.status,
    progress: value.progress,
    progressDetail: value.progressDetail ?? null,
    score: value.score,
    pageType: value.pageType,
    verdict: value.verdict,
    flagCount: value.flagCount,
    screenshotCapture: value.screenshotCapture,
    screenshots: value.screenshots?.map((shot) => [shot.device, shot.url]),
    rubrics: value.rubrics?.map((rubric) => [
      rubric.name,
      rubric.grade,
      rubric.score,
      rubric.status,
    ]),
    partialFlags: value.partialFlags?.map((flag) => [
      flag.id,
      flag.severity,
      flag.problem,
      flag.rubric,
      flag.checkId,
      flag.source,
    ]),
    pages: value.pages?.map((page) => [page.position, page.url, page.status]),
    actionTimeline: value.actionTimeline,
    productContract: value.productContract,
    technologyProfile: value.technologyProfile,
    agentMessages: value.agentMessages?.map((message) => [
      message.id,
      message.state,
      message.content,
    ]),
  })
}

/**
 * Poll lightweight `/status` until terminal. Full report HTML comes from
 * `router.refresh()` in AuditPageClient — avoid a duplicate `/api/reports/[id]` fetch.
 */
export function useAuditPolling(auditId: string, options: UseAuditPollingOptions = {}) {
  const { initialAudit, pollStatus = true } = options
  const [pendingRestart, setPendingRestart] = useState(false)
  const initialStatus = (initialAudit?.status ?? 'QUEUED') as string
  const initialTerminal = TERMINAL_STATUSES.has(initialStatus)
  const [keepPolling, setKeepPolling] = useState(!initialTerminal)
  const statusKey = `/api/reports/${auditId}/status`

  const { data: statusData, error: statusError, isLoading: statusLoading, isValidating } = useSWR(
    pollStatus && (pendingRestart || keepPolling) ? statusKey : null,
    jsonFetcher,
    {
      refreshInterval: (latest) => pollIntervalMs(latest as AuditStatusPayload | undefined),
      revalidateOnFocus: false,
      compare: (a: AuditStatusPayload | undefined, b: AuditStatusPayload | undefined) => {
        if (a === b) return true
        if (!a || !b) return false
        return progressivePayloadFingerprint(a) === progressivePayloadFingerprint(b)
      },
    }
  )

  useEffect(() => {
    if (pendingRestart) setKeepPolling(true)
  }, [pendingRestart])

  useEffect(() => {
    if (!statusData) return
    if (pendingRestart && isValidating) return
    if (pendingRestart) setPendingRestart(false)
    setKeepPolling(!TERMINAL_STATUSES.has(statusData.status))
  }, [pendingRestart, isValidating, statusData])

  const currentStatus = (
    pendingRestart && (!statusData || TERMINAL_STATUSES.has(statusData.status))
      ? 'QUEUED'
      : (statusData?.status ?? initialStatus)
  ) as string
  const isFailed = currentStatus === 'FAILED'
  const isComplete = currentStatus === 'COMPLETED'
  const terminalNow = TERMINAL_STATUSES.has(currentStatus)

  const audit = initialTerminal && !pendingRestart ? initialAudit : null

  const error = statusError
  const errStatus = (error as Error & { status?: number })?.status
  const isLoading = pollStatus && !terminalNow && statusLoading && !statusData

  const statusPayload = pendingRestart && (!statusData || TERMINAL_STATUSES.has(statusData.status))
    ? {
        status: 'QUEUED',
        progress: PIPELINE_PROGRESS.QUEUED,
        failureCode: null,
        url: (statusData?.url ?? initialAudit?.url ?? '') as string,
        agentMessages: [],
      }
    : statusData as AuditStatusPayload | undefined

  const resumePolling = useCallback(() => {
    setPendingRestart(true)
    setKeepPolling(true)
  }, [])

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
    progress: (
      pendingRestart && (!statusData || TERMINAL_STATUSES.has(statusData.status))
        ? PIPELINE_PROGRESS.QUEUED
        : (statusData?.progress ?? initialAudit?.progress ?? 0)
    ) as number,
    url: (statusData?.url ?? initialAudit?.url) as string | undefined,
    startedAt: (statusData?.startedAt ?? initialAudit?.startedAt) as string | null | undefined,
    statusPayload,
    resumePolling,
  }
}
