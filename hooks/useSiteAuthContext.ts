'use client'

import { useEffect, useMemo, useState } from 'react'
import { displayHostname } from '@/lib/utils/url-helpers'
import { siteAuthDestination } from '@/lib/auth/report-context'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'

export function useSiteAuthContext(next: string | null) {
  const destination = useMemo(() => siteAuthDestination(next), [next])
  const kind = destination?.kind, id = destination?.id
  const owner = useMemo(() => kind && id ? { kind, id } : null, [kind, id])
  const [recorded, setRecorded] = useState<{ owner: NonNullable<typeof owner>; hostname: string } | null>(null)

  useEffect(() => {
    if (!owner) return
    const controller = new AbortController()
    const endpoint = owner.kind === 'site' ? `/api/sites/${encodeURIComponent(owner.id)}?scope=identity`
      : `/api/reports/${encodeURIComponent(owner.id)}/status`
    void fetchJsonWithDeadline(endpoint, { cache: 'no-store', signal: controller.signal }, 15_000)
      .then(({ response, body }) => {
        if (!response.ok || !body || typeof body !== 'object') return
        let url: URL
        if (owner.kind === 'site') {
          if (!('siteId' in body) || body.siteId !== owner.id || !('hostname' in body) || typeof body.hostname !== 'string') return
          url = new URL(`https://${body.hostname}`)
          if (url.hostname !== body.hostname) return
        } else {
          if (!('id' in body) || body.id !== owner.id || !('url' in body) || typeof body.url !== 'string') return
          url = new URL(body.url)
        }
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || controller.signal.aborted) return
        setRecorded({ owner, hostname: displayHostname(url.href) })
      })
      .catch(() => { /* Identity is optional; authentication remains available. */ })

    return () => controller.abort()
  }, [owner])

  return {
    siteHref: destination?.href ?? null,
    hostname: recorded?.owner === owner ? recorded?.hostname ?? null : null,
    isSiteContext: Boolean(destination),
  }
}
