import { safeFetchDocument } from '@/lib/audit/url'
import { publicResponseRestriction } from '@/lib/audit/browser/page-capture'
import type { ProbeObservation } from './domain'
import { PublicResponseBodyError } from '@/lib/audit/http-evidence'
import { classifyPublicRequestFailure } from '@/lib/audit/http-failure'
import { PublicRedirectError } from '@/lib/audit/redirect-evidence'

type Document = Awaited<ReturnType<typeof safeFetchDocument>>

export function classifyUptimeResponse(document: Document): Pick<ProbeObservation, 'result' | 'reason'> {
  const status = document.statusCode
  if (publicResponseRestriction({ body: document.body, headers: document.headers, status }))
    return { result: 'UNKNOWN', reason: status === 429 ? 'rate_limited' : 'access_blocked' }
  if (status >= 200 && status < 300) return { result: 'ONLINE', reason: 'response_received' }
  if (status >= 400) return { result: 'FAILED', reason: 'response_error' }
  return { result: 'UNKNOWN', reason: 'redirect_unresolved' }
}

export async function probeUptime(url: string, fetchDocument = safeFetchDocument): Promise<ProbeObservation> {
  let started: number | null = null
  const duration = () => started === null ? 0 : Date.now() - started
  try {
    const document = await fetchDocument(url, { timeoutMs: 8000, maxBytes: 64_000, maxRedirects: 5, publicOnly: true,
      onRequestStart: () => { started = Date.now() } })
    return { ...classifyUptimeResponse(document), statusCode: document.statusCode,
      durationMs: duration(), finalUrl: document.finalUrl }
  } catch (error) {
    const bodyError = error instanceof PublicResponseBodyError || error instanceof PublicRedirectError ? error : null
    return { ...classifyPublicRequestFailure(error),
      statusCode: bodyError?.response.statusCode ?? null, durationMs: duration(), finalUrl: bodyError?.response.finalUrl ?? null }
  }
}
