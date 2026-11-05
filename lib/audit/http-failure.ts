import { AuditUrlError } from './url'
import { certificateFailureReason, readCertificateFailure } from './tls-evidence'
import { PublicResponseBodyError } from './http-evidence'
import { PublicRedirectError } from './redirect-evidence'

/** Recognized public transport failures establish unavailable reachability.
 * Safety refusals, uncertain trust and local execution errors do not. */
export function classifyPublicRequestFailure(error: unknown): { result: 'FAILED' | 'UNKNOWN'; reason: string } {
  if (error instanceof PublicRedirectError) return error.reason === 'redirect_loop'
    ? { result: 'FAILED', reason: 'redirect_loop' } : { result: 'UNKNOWN', reason: 'redirect_unresolved' }
  if (error instanceof PublicResponseBodyError) return classifyPublicRequestFailure(error.cause)
  if (error instanceof AuditUrlError) {
    return error.code === 'DNS_NOT_FOUND' ? { result: 'FAILED', reason: 'dns_failure' }
      : { result: 'UNKNOWN', reason: 'public_target_unverified' }
  }
  const source = error instanceof Error ? error : null
  const cause = source?.cause as { code?: string } | undefined
  const code = cause?.code ?? (source as Error & { code?: string } | null)?.code
  const certificateFailure = readCertificateFailure(error)
  if (certificateFailure) return { result: 'FAILED', reason: certificateFailureReason(certificateFailure) }
  if (['ENOTFOUND', 'ENODATA', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(code ?? ''))
    return { result: 'FAILED', reason: code === 'ENOTFOUND' || code === 'ENODATA' ? 'dns_failure' : code?.includes('TIMEOUT') || code === 'ETIMEDOUT' ? 'response_timeout' : 'connection_failed' }
  return { result: 'UNKNOWN', reason: 'probe_unavailable' }
}
