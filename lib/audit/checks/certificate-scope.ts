import { destinationContext, displayDestination } from './destination-evidence'
import { certificateFailureReason, certificateFailureSchema } from '../tls-evidence'
import { TLS_CERTIFICATE_COPY } from '@/lib/marketing/copy/tls'

export function certificateRequestScope(pageUrl: string) {
  return 'tls-certificate:v2:' + destinationContext(pageUrl, pageUrl) + ':'
}

export function certificatePeerContext(pageUrl: string, peerUrl: string) {
  return certificateRequestScope(pageUrl) + destinationContext(pageUrl, new URL(peerUrl).origin)
}

export function legacyCertificateRequestContext(pageUrl: string) {
  return 'tls-certificate:v1:' + destinationContext(pageUrl, pageUrl)
}

/** The v1 HTTP detector retained one exact, redacted endpoint in the recorded
 * observation. Admit only its original format and a complete display URL. */
export function readLegacyCertificatePeer(pageUrl: string, observed: string, passed: boolean) {
  let endpoint: string | undefined
  if (passed) {
    endpoint = /^The public request reached (https:\/\/\S+) over HTTPS with normal certificate and hostname verification\.$/.exec(observed)?.[1]
  } else {
    const match = /^([^\r\n]+) at (https:\/\/\S+) \(([A-Z_]+)\)\. No HTTP response was obtained\.$/.exec(observed)
    const failure = certificateFailureSchema.safeParse({ kind: 'tls-certificate', code: match?.[3] })
    if (match && failure.success && match[1] === TLS_CERTIFICATE_COPY[certificateFailureReason(failure.data)].label) endpoint = match[2]
  }
  if (!endpoint || endpoint.length >= 500 || displayDestination(endpoint) !== endpoint) return null
  return certificatePeerContext(pageUrl, endpoint)
}
