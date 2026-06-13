'use client'
import useSWR from 'swr'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

async function auditFetcher(url: string) {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || 'Failed to load audit') as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data
}

export function useAuditPolling(auditId: string) {
  const { data, error, isLoading } = useSWR(
    `/api/audits/${auditId}`,
    auditFetcher,
    {
      refreshInterval: (latest) => {
        if (!latest) return 2000
        if (TERMINAL_STATUSES.has(latest.status)) return 0
        return 2000
      },
      revalidateOnFocus: false,
    }
  )

  const errStatus = (error as Error & { status?: number })?.status

  return {
    audit: data,
    isLoading,
    error,
    isComplete: data?.status === 'COMPLETED',
    isFailed: data?.status === 'FAILED',
    isNotFound: errStatus === 404,
    isForbidden: errStatus === 403,
    fetchError: error ? (error as Error).message : null,
    status: data?.status ?? 'QUEUED',
  }
}
