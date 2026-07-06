'use client'
import useSWR from 'swr'

export interface RepoScanFinding {
  id: string
  severity: string
  category: string
  filePath: string
  lineStart: number | null
  lineEnd: number | null
  problem: string
  evidence: string
  fix: string
  agentPrompt: string | null
  fixPr?: {
    id: string
    status: 'DRAFT' | 'CREATING' | 'CREATED' | 'FAILED'
    prNumber: number | null
    prUrl: string | null
    patchApplied: boolean
    errorMsg: string | null
  } | null
}

export interface RepoScan {
  id: string
  repoFullName: string
  commitSha: string | null
  status: string
  errorMsg: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  findings: RepoScanFinding[]
}

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

async function jsonFetcher(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to load repo scan') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Poll a repo scan until it reaches a terminal status. Mirrors useAuditPolling
 * but the single endpoint already returns the full scan plus findings, so there
 * is no separate completed-fetch step.
 */
export function useRepoScanPolling(scanId: string, initialScan?: RepoScan | null) {
  const initialTerminal = Boolean(initialScan && TERMINAL_STATUSES.has(initialScan.status))

  const { data, error, isLoading } = useSWR(
    initialTerminal ? null : `/api/repo-scans/${scanId}`,
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        latest?.scan && TERMINAL_STATUSES.has(latest.scan.status) ? 0 : 2000,
      revalidateOnFocus: false,
      fallbackData: initialScan ? { scan: initialScan } : undefined,
    }
  )

  const scan = (data?.scan ?? initialScan ?? null) as RepoScan | null
  const status = scan?.status ?? 'QUEUED'
  const errStatus = (error as Error & { status?: number })?.status

  return {
    scan,
    status,
    isComplete: status === 'COMPLETED',
    isFailed: status === 'FAILED',
    isLoading: isLoading && !scan,
    isNotFound: errStatus === 404,
    error: error ? (error as Error).message : null,
  }
}
