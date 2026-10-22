import { z } from 'zod'

const certificateReasons = {
  CERT_HAS_EXPIRED: 'certificate_expired', CERT_NOT_YET_VALID: 'certificate_not_yet_valid',
  ERR_TLS_CERT_ALTNAME_INVALID: 'certificate_name_mismatch', HOSTNAME_MISMATCH: 'certificate_name_mismatch',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'certificate_untrusted', SELF_SIGNED_CERT_IN_CHAIN: 'certificate_untrusted',
  CERT_REVOKED: 'certificate_revoked', CERT_SIGNATURE_FAILURE: 'certificate_invalid',
  ERROR_IN_CERT_NOT_BEFORE_FIELD: 'certificate_invalid', ERROR_IN_CERT_NOT_AFTER_FIELD: 'certificate_invalid',
} as const
const codeSchema = z.enum(Object.keys(certificateReasons) as Array<keyof typeof certificateReasons>)
export const certificateFailureSchema = z.object({ kind: z.literal('tls-certificate'), code: codeSchema }).strict()
export type CertificateFailure = z.infer<typeof certificateFailureSchema>
export type CertificateFailureReason = typeof certificateReasons[keyof typeof certificateReasons]
export const TLS_CERTIFICATE_VERIFICATION_RULE = 'Repeat the original public URL request and observe an HTTPS response with normal certificate and hostname verification. Missing transport evidence or an HTTP downgrade cannot establish recovery.'

/** The native transport records the last attempted public hop without copying
 * error text or certificate objects into the observation. */
export class PublicCertificateError extends Error {
  readonly code: CertificateFailure['code']
  constructor(public readonly url: string, public readonly redirects: string[],
    public readonly failure: CertificateFailure, cause: unknown) {
    super('Public TLS certificate validation failed', { cause })
    this.name = 'PublicCertificateError'; this.code = failure.code
  }
}

/** Native error codes establish peer refusal. Unknown issuers, local client
 * configuration and message text alone cannot establish a certificate failure. */
export function readCertificateFailure(error: unknown): CertificateFailure | null {
  if (!(error instanceof Error)) return null
  const cause = error.cause as { code?: unknown } | undefined
  const code = codeSchema.safeParse(cause?.code ?? (error as Error & { code?: unknown }).code)
  return code.success ? { kind: 'tls-certificate', code: code.data } : null
}
export function certificateFailureReason(failure: CertificateFailure): CertificateFailureReason {
  return certificateReasons[failure.code]
}
