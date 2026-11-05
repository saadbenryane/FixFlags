import type { CertificateFailureReason } from '@/lib/audit/tls-evidence'

export const TLS_CERTIFICATE_COPY = {
  certificate_expired: { label: 'Certificate expired', problem: 'The HTTPS certificate has expired',
    fix: 'Renew the certificate on the affected HTTPS endpoint and publish its full certificate chain. Recheck the original URL over HTTPS.' },
  certificate_not_yet_valid: { label: 'Certificate not yet valid', problem: 'The HTTPS certificate is not yet valid',
    fix: 'Check the published certificate validity dates. Install a certificate that is valid now, then recheck the original URL over HTTPS.' },
  certificate_name_mismatch: { label: 'Certificate does not match the hostname', problem: 'The HTTPS certificate does not match the reached hostname',
    fix: 'Install a certificate covering the reached hostname, or correct the redirect to the intended HTTPS hostname. Recheck the original URL.' },
  certificate_untrusted: { label: 'Self-signed certificate not trusted', problem: 'The public HTTPS connection uses an untrusted self-signed certificate',
    fix: 'Install a publicly trusted certificate and its full certificate chain for the affected hostname. Recheck the original URL over HTTPS.' },
  certificate_revoked: { label: 'Certificate revoked', problem: 'The HTTPS certificate has been revoked',
    fix: 'Replace the revoked certificate with a valid certificate and publish its full chain. Recheck the original URL over HTTPS.' },
  certificate_invalid: { label: 'Certificate verification failed', problem: 'The HTTPS certificate could not be validated',
    fix: 'Replace the malformed or incorrectly signed certificate and publish its full certificate chain. Recheck the original URL over HTTPS.' },
} as const satisfies Record<CertificateFailureReason, { label: string; problem: string; fix: string }>
export const TLS_CERTIFICATE_LABELS = Object.fromEntries(Object.entries(TLS_CERTIFICATE_COPY).map(([key, value]) => [key, value.label])) as {
  [K in keyof typeof TLS_CERTIFICATE_COPY]: typeof TLS_CERTIFICATE_COPY[K]['label']
}
