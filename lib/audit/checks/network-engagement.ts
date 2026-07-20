import type { NetworkFailureRecord } from '../browser/network-monitor'
import type { FormProbeResult } from '../browser/journey-safety'
import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'

const NETWORK_CHECK_DESCRIPTORS = [
  {
    id: 'api-engagement-unauthorized',
    severity: 'CRITICAL' as const,
    tags: ['requiresBrowser', 'network'],
  },
  {
    id: 'api-engagement-server-error',
    severity: 'CRITICAL' as const,
    tags: ['requiresBrowser', 'network'],
  },
  {
    id: 'form-submit-api-unauthorized',
    severity: 'CRITICAL' as const,
    tags: ['requiresBrowser', 'form-probe'],
  },
  {
    id: 'form-submit-api-server-error',
    severity: 'CRITICAL' as const,
    tags: ['requiresBrowser', 'form-probe'],
  },
] as const

for (const descriptor of NETWORK_CHECK_DESCRIPTORS) {
  registerCheck({
    id: descriptor.id,
    rubric: 'EXPERIENCE',
    impactTag: 'CONVERSION',
    severity: descriptor.severity,
    tags: [...descriptor.tags],
    requiresBrowser: true,
    evaluate: () => null,
  })
}

function flagBase(
  checkId: (typeof NETWORK_CHECK_DESCRIPTORS)[number]['id'],
  problem: string,
  evidence: string,
  fix: string
): DeterministicFlag {
  return {
    checkId,
    rubric: 'EXPERIENCE',
    severity: 'CRITICAL',
    impactTag: 'CONVERSION',
    problem,
    evidence,
    fix,
    confidence: 0.95,
    source: 'DETERMINISTIC',
  }
}

/**
 * Emit Flags from same-origin engagement network failures and controlled form probes.
 */
export function runNetworkEngagementChecks(
  networkFailures: NetworkFailureRecord[] | null | undefined,
  formProbe?: FormProbeResult | null
): DeterministicFlag[] {
  const flags: DeterministicFlag[] = []

  const engagement = (networkFailures ?? []).filter((f) => f.sameOrigin && f.engagementPath)

  const unauthorized = engagement.find((f) => f.status === 401 || f.status === 403)
  if (unauthorized) {
    flags.push(
      flagBase(
        'api-engagement-unauthorized',
        'Engagement API returned unauthorized',
        `${unauthorized.method} ${unauthorized.status} ${unauthorized.url}`,
        '1. Fix auth on the engagement API (CSRF token, session cookie, CORS, or public nonce).\n2. Return a clear user-facing error when auth fails.\n3. Re-check the form submit after deploying.'
      )
    )
  }

  const serverErr = engagement.find((f) => f.status >= 500)
  if (serverErr) {
    flags.push(
      flagBase(
        'api-engagement-server-error',
        'Engagement API returned a server error',
        `${serverErr.method} ${serverErr.status} ${serverErr.url}`,
        '1. Inspect server logs for the failing engagement endpoint.\n2. Fix the 5xx cause and add monitoring.\n3. Re-check the form or CTA that triggers this request.'
      )
    )
  }

  if (formProbe && formProbe.status > 0) {
    if (formProbe.status === 401 || formProbe.status === 403) {
      flags.push(
        flagBase(
          'form-submit-api-unauthorized',
          'Form submission API returned unauthorized',
          `${formProbe.method} ${formProbe.status} ${formProbe.url}`,
          '1. Ensure anonymous newsletter/contact endpoints accept valid public submissions or issue a session/CSRF token.\n2. Surface a specific error instead of a generic failure.\n3. Re-check after fix.'
        )
      )
    } else if (formProbe.status >= 500) {
      flags.push(
        flagBase(
          'form-submit-api-server-error',
          'Form submission API returned a server error',
          `${formProbe.method} ${formProbe.status} ${formProbe.url}`,
          '1. Fix the server error on the submit endpoint.\n2. Add retry and clearer error copy.\n3. Re-check the form submit.'
        )
      )
    }
  }

  return flags
}
