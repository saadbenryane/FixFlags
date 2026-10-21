import { TLS_CERTIFICATE_COPY } from './tls'

export const REDIRECT_LOOP_COPY = {
  summary: 'The page redirects in a loop.',
  problem: 'This page is stuck in a redirect loop.',
  fix: '1. Check the redirect rules for this page, including HTTPS and preferred-host rules.\n2. Remove the repeating route so the original URL reaches a successful public response.\n3. Verify the same page again after the change.',
}

const failures: Record<string, { summary: string; problem: string; evidence: string; fix: string }> = {
  redirect_loop: { ...REDIRECT_LOOP_COPY,
    evidence: 'The bounded public request repeatedly followed the same redirect route. An independent confirmation attempt observed another repeating loop.' },
  http_unavailable: {
    summary: 'The page was unavailable.',
    problem: 'A required page did not respond successfully.',
    evidence: 'FixFlags requested the bound page and received an unsuccessful response.',
    fix: 'Restore the page so a public request succeeds, then verify this Outcome again.',
  },
  expected_surface_missing: {
    summary: 'The page did not show its expected content.',
    problem: 'A required page did not show its configured content in the browser.',
    evidence: 'The public request succeeded, but the configured text or visible element was absent from the rendered page. An independent confirmation attempt also failed.',
    fix: 'Restore the configured content on the same page. Check rendering and client errors, then verify the same Outcome again.',
  },
  dns_failure: {
    summary: 'The page hostname did not resolve.',
    problem: 'A required page could not be reached because its hostname did not resolve.',
    evidence: 'The public request reported no DNS records for the requested hostname. An independent confirmation attempt also failed.',
    fix: 'Check the requested hostname, its DNS records and nameservers. Restore public resolution, then verify the same page again.',
  },
  connection_failed: {
    summary: 'The page connection failed.',
    problem: 'A required page connection was refused or interrupted.',
    evidence: 'The public request reported a refused or reset connection. An independent confirmation attempt also failed.',
    fix: 'Check the hosting service, its public listener and connection handling. Restore the page response, then verify the same page again.',
  },
  response_timeout: {
    summary: 'The page response timed out.',
    problem: 'A required page did not respond within the public request deadline.',
    evidence: 'The public request reported a connection or response timeout. An independent confirmation attempt also failed.',
    fix: 'Check hosting availability and slow request handling. Restore a timely public response, then verify the same page again.',
  },
}

export function availabilityFailureCopy(reason: string) {
  if (Object.hasOwn(TLS_CERTIFICATE_COPY, reason)) {
    const certificate = TLS_CERTIFICATE_COPY[reason as keyof typeof TLS_CERTIFICATE_COPY]
    return { summary: certificate.label, problem: certificate.problem,
      evidence: `${certificate.label}. The public request was refused by normal certificate or hostname verification. An independent confirmation attempt also failed.`,
      fix: certificate.fix }
  }
  return Object.hasOwn(failures, reason) ? failures[reason] : null
}
