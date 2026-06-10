'use client'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

export function useAuditPolling(auditId: string) {
  const { data, error, isLoading } = useSWR(
    `/api/audits/${auditId}`,
    fetcher,
    {
      refreshInterval: (data) => {
        if (!data) return 2000
        if (TERMINAL_STATUSES.has(data.status)) return 0
        return 2000
      },
      revalidateOnFocus: false,
    }
  )

  return {
    audit: data,
    isLoading,
    error,
    isComplete: data?.status === 'COMPLETED',
    isFailed: data?.status === 'FAILED',
    status: data?.status ?? 'QUEUED',
  }
}
