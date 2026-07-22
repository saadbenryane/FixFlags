'use client'

import { useEffect, useMemo, useState } from 'react'
import { displayHostname } from '@/lib/utils/url-helpers'
import { reportIdFromNextPath } from '@/lib/auth/report-context'

export function useReportAuthContext(next: string | null) {
  const reportId = useMemo(() => reportIdFromNextPath(next), [next])
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) {
      setUrl(null)
      return
    }

    const controller = new AbortController()
    void fetch(`/api/reports/${reportId}/status`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ url?: unknown }>
      })
      .then((payload) => {
        if (typeof payload?.url === 'string') setUrl(payload.url)
      })
      .catch(() => {})

    return () => controller.abort()
  }, [reportId])

  return {
    reportId,
    reportHref: reportId ? `/report/${reportId}` : null,
    hostname: url ? displayHostname(url) : null,
    isReportContext: Boolean(reportId),
  }
}
