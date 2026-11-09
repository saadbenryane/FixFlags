import { AuditUrlError } from './url'
import { certificateFailureReason, isCertificateFailureReason, readCertificateFailure, tlsPeerOrigin } from './tls-evidence'
import { PublicResponseBodyError } from './http-evidence'
import { PublicRedirectError } from './redirect-evidence'

/** Recognized public transport failures establish unavailable reachability.
 * Safety refusals, uncertain trust and local execution errors do not. */
export function classifyPublicRequestFailure(error: unknown): { result: 'FAILED' | 'UNKNOWN'; reason: string } {
  if (error instanceof PublicRedirectError) return error.reason === 'redirect_loop'
    ? { result: 'FAILED', reason: 'redirect_loop' } : { result: 'UNKNOWN', reason: 'redirect_unresolved' }
  // A received response with interrupted content cannot establish reachability
  // failure, even when its cause shares a pre-response transport error code.
  if (error instanceof PublicResponseBodyError) return { result: 'UNKNOWN', reason: 'probe_unavailable' }
  if (error instanceof AuditUrlError) {
    return error.code === 'DNS_NOT_FOUND' ? { result: 'FAILED', reason: 'dns_failure' }
      : { result: 'UNKNOWN', reason: 'public_target_unverified' }
  }
  type TransportError = { code?: string; socket?: { bytesWritten?: number } }
  const source = error instanceof Error ? error as Error & TransportError : null
  const cause = source?.cause as TransportError | undefined
  const transport = cause?.code ? cause : source
  const code = transport?.code
  const certificateFailure = readCertificateFailure(error)
  if (certificateFailure) return { result: 'FAILED', reason: certificateFailureReason(certificateFailure) }
  // The generic socket code also covers local dispatcher failures. Require
  // evidence that bytes were written on the connection before it closed.
  if (code === 'UND_ERR_SOCKET' && (transport?.socket?.bytesWritten ?? 0) > 0)
    return { result: 'FAILED', reason: 'connection_failed' }
  if (['ENOTFOUND', 'ENODATA', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT'].includes(code ?? ''))
    return { result: 'FAILED', reason: code === 'ENOTFOUND' || code === 'ENODATA' ? 'dns_failure' : code?.includes('TIMEOUT') || code === 'ETIMEDOUT' ? 'response_timeout' : 'connection_failed' }
  return { result: 'UNKNOWN', reason: 'probe_unavailable' }
}

/** Only a classified transport failure can identify a peer without an HTTP response. */
export function publicTransportFailureOrigin(reason: string, value: string | null): string | null {
  if (isCertificateFailureReason(reason)) return tlsPeerOrigin(value)
  if (!['dns_failure', 'connection_failed', 'response_timeout'].includes(reason) || !value || !URL.canParse(value)) return null
  const url = new URL(value)
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
}
