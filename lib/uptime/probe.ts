import { safeFetchDocument } from '@/lib/audit/url'
import { isPublicSignInRedirect, publicResponseRestriction } from '@/lib/audit/browser/page-capture'
import type { ProbeObservation } from './domain'
import { isSuccessfulPublicGetStatus, PublicResponseBodyError } from '@/lib/audit/http-evidence'
import { classifyPublicRequestFailure, publicTransportFailureOrigin } from '@/lib/audit/http-failure'
import { PublicRedirectError } from '@/lib/audit/redirect-evidence'
import { PublicCertificateError } from '@/lib/audit/tls-evidence'
import { displayDestination } from '@/lib/audit/checks/destination-evidence'

type Document = Awaited<ReturnType<typeof safeFetchDocument>>

/** Preserve the reached HTTP path or the transport peer, without recording
 * redirect credentials. The actual fetch still uses the complete URL. */
export function recordedUptimeFinalUrl({ statusCode, reason, finalUrl }: Pick<ProbeObservation, 'statusCode' | 'reason' | 'finalUrl'>) {
  if (statusCode === null) return publicTransportFailureOrigin(reason, finalUrl)
  return finalUrl && URL.canParse(finalUrl) ? displayDestination(finalUrl) : null
}

export function classifyUptimeResponse(document: Document): Pick<ProbeObservation, 'result' | 'reason'> {
  const status = document.statusCode
  if (publicResponseRestriction({ body: document.body, headers: document.headers, status }))
    return { result: 'UNKNOWN', reason: status === 429 ? 'rate_limited' : 'access_blocked' }
  if (isSuccessfulPublicGetStatus(status)) {
    const requestedUrl = document.redirects[0]
    if (requestedUrl && isPublicSignInRedirect({ ...document, status, requestedUrl }))
      return { result: 'UNKNOWN', reason: 'access_blocked' }
    return { result: 'ONLINE', reason: 'response_received' }
  }
  if (status === 206) return { result: 'UNKNOWN', reason: 'probe_unavailable' }
  if (status >= 400) return { result: 'FAILED', reason: 'response_error' }
  return { result: 'UNKNOWN', reason: 'redirect_unresolved' }
}

export async function probeUptime(url: string, fetchDocument = safeFetchDocument): Promise<ProbeObservation> {
  let started: number | null = null
  let attemptedOrigin: string | null = null
  const duration = () => started === null ? 0 : Date.now() - started
  try {
    const document = await fetchDocument(url, { timeoutMs: 8000, maxBytes: 64_000, maxRedirects: 5, publicOnly: true,
      onRequestStart: () => { started = Date.now() }, onHopStart: origin => { attemptedOrigin = origin } })
    return { ...classifyUptimeResponse(document), statusCode: document.statusCode,
      durationMs: duration(), finalUrl: document.finalUrl }
  } catch (error) {
    const bodyError = error instanceof PublicResponseBodyError || error instanceof PublicRedirectError ? error : null
    const response = error instanceof PublicResponseBodyError
      ? classifyUptimeResponse({ ...error.response, body: error.response.body ?? '' }) : null
    const failure = response && response.result !== 'ONLINE' ? response : classifyPublicRequestFailure(error)
    return { ...failure,
      statusCode: bodyError?.response.statusCode ?? null, durationMs: duration(),
      finalUrl: bodyError?.response.finalUrl ?? publicTransportFailureOrigin(failure.reason,
        error instanceof PublicCertificateError ? error.url : attemptedOrigin) }
  }
}
