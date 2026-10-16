import { AuditUrlError, safeFetchDocument } from '@/lib/audit/url'
import { publicResponseRestriction } from '@/lib/audit/browser/page-capture'
import type { ProbeObservation } from './domain'

type Document = Awaited<ReturnType<typeof safeFetchDocument>>

export function classifyUptimeResponse(document: Document): Pick<ProbeObservation, 'result' | 'reason'> {
  const status = document.statusCode
  if (publicResponseRestriction({ body: document.body, headers: document.headers, status }))
    return { result: 'UNKNOWN', reason: status === 429 ? 'rate_limited' : 'access_blocked' }
  if (status >= 200 && status < 300) return { result: 'ONLINE', reason: 'response_received' }
  if (status >= 400) return { result: 'FAILED', reason: 'response_error' }
  return { result: 'UNKNOWN', reason: 'redirect_unresolved' }
}

export function classifyUptimeError(error: unknown): Pick<ProbeObservation, 'result' | 'reason'> {
  if (error instanceof AuditUrlError) {
    return error.code === 'DNS_NOT_FOUND' ? { result: 'FAILED', reason: 'dns_failure' }
      : { result: 'UNKNOWN', reason: 'public_target_unverified' }
  }
  const source = error instanceof Error ? error : null
  const cause = source?.cause as { code?: string } | undefined
  const code = cause?.code ?? (source as Error & { code?: string } | null)?.code
  if (['ENOTFOUND', 'ENODATA', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(code ?? ''))
    return { result: 'FAILED', reason: code === 'ENOTFOUND' || code === 'ENODATA' ? 'dns_failure' : code?.includes('TIMEOUT') || code === 'ETIMEDOUT' ? 'response_timeout' : 'connection_failed' }
  return { result: 'UNKNOWN', reason: 'probe_unavailable' }
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
    return { ...classifyUptimeError(error), statusCode: null, durationMs: duration(), finalUrl: null }
  }
}
