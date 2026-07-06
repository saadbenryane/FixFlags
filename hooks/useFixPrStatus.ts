'use client'
import useSWR from 'swr'

export interface RepoFixPr {
  id: string
  status: 'DRAFT' | 'CREATING' | 'CREATED' | 'FAILED'
  prNumber: number | null
  prUrl: string | null
  patchApplied: boolean
  errorMsg: string | null
}

const TERMINAL_STATUSES = new Set(['CREATED', 'FAILED'])

async function jsonFetcher(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.message || 'Failed to load fix PR status') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

/**
 * Polls a fix PR's status. `enabled` should only be true once a fix PR is known to exist
 * (either it was already created in a prior session, passed in via `initialFixPr`, or the
 * user just requested one) - otherwise this would poll a 404 forever for the common case of
 * a finding with no fix PR at all. Mirrors useRepoScanPolling.
 */
export function useFixPrStatus(
  repoScanId: string,
  findingId: string,
  enabled: boolean,
  initialFixPr?: RepoFixPr | null
) {
  const initialTerminal = Boolean(initialFixPr && TERMINAL_STATUSES.has(initialFixPr.status))

  const { data, error, isLoading, mutate } = useSWR(
    enabled && !initialTerminal ? `/api/repo-scans/${repoScanId}/findings/${findingId}/fix-pr` : null,
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        latest?.fixPr && TERMINAL_STATUSES.has(latest.fixPr.status) ? 0 : 2000,
      revalidateOnFocus: false,
      shouldRetryOnError: (err: Error & { status?: number }) => err.status !== 404,
      fallbackData: initialFixPr ? { fixPr: initialFixPr } : undefined,
    }
  )

  const fixPr = (data?.fixPr ?? initialFixPr ?? null) as RepoFixPr | null
  const errStatus = (error as Error & { status?: number })?.status

  return {
    fixPr,
    isLoading: enabled && isLoading && !fixPr,
    isNotFound: errStatus === 404,
    refresh: mutate,
  }
}

export async function requestFixPr(
  repoScanId: string,
  findingId: string
): Promise<{ repoFixPrId: string }> {
  const res = await fetch(`/api/repo-scans/${repoScanId}/findings/${findingId}/fix-pr`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Could not start the fix PR')
  }
  return data
}
