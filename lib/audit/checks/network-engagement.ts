import type { NetworkFailureRecord } from '../browser/network-monitor'
import type { FormProbeResult } from '../browser/journey-safety'
import type { DeterministicFlag } from '../flag-types'
import { registerCheck } from './registry'
import type { CheckAssertion } from './assertion'
import { engagementContext, engagementEvidenceSchema, ENGAGEMENT_VERIFICATION_RULE, type EngagementEvidence } from '../network-engagement-evidence'
import { trackingRequestKey } from '../tracking/identity'
import { displayDestination } from './destination-evidence'

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
  {
    id: 'form-submit-silent-failure',
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
  return buildEngagementFlags((networkFailures ?? []).filter(failure => failure.sameOrigin && failure.engagementPath), formProbe)
}

function buildEngagementFlags(engagement: readonly FormProbeResult[], formProbe?: FormProbeResult | null): DeterministicFlag[] {
  const flags: DeterministicFlag[] = []

  const unauthorized = engagement.find((f) => f.status === 401 || f.status === 403)
  if (unauthorized) {
    flags.push(
      flagBase(
        'api-engagement-unauthorized',
        'Engagement API returned unauthorized',
        `${unauthorized.method} ${unauthorized.status} ${displayDestination(unauthorized.url)}`,
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
        `${serverErr.method} ${serverErr.status} ${displayDestination(serverErr.url)}`,
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

function requestLabel(request: EngagementEvidence['requests'][number]) {
  return `${request.method} ${request.destination}${request.redirectKey ? ' (redirect chain)' : ''}`
}

/** Failure and recovery consume the same bounded native requests. Disappearing
 * requests and a different access response never supply positive proof. */
export function networkEngagementObservations(input: {
  pageUrl: string; failures: NetworkFailureRecord[]; probe?: FormProbeResult | null;
  evidence?: EngagementEvidence; expected?: boolean;
}) {
  const evidence = input.evidence && engagementEvidenceSchema.parse(input.evidence)
  const rawFailures = input.failures.filter(failure => failure.sameOrigin && failure.engagementPath)
  const observedFailures = evidence?.requests.flatMap(request => !request.responseKind && request.status !== null && request.status >= 400
    ? [{ url: request.destination, status: request.status, method: request.method }] : []) ?? []
  const flags = buildEngagementFlags([...observedFailures, ...rawFailures], input.probe)
  const assertions: CheckAssertion[] = []
  const groups = new Map<string, { context?: string; requests: EngagementEvidence['requests'] }>()
  for (const request of evidence?.requests ?? []) {
    const context = engagementContext(request, input.pageUrl, evidence?.version)
    const key = context ?? JSON.stringify([request.redirectKey ?? request.requestKey, request.phase, request.captureKey])
    const group = groups.get(key) ?? { context, requests: [] }
    group.requests.push(request); groups.set(key, group)
  }
  const policies = [
    { key: 'engagement-auth-response', checkId: 'api-engagement-unauthorized', failed: (status: number) => status === 401 || status === 403 },
    { key: 'engagement-server-response', checkId: 'api-engagement-server-error', failed: (status: number) => status >= 500 },
    { key: 'form-auth-response', checkId: 'form-submit-api-unauthorized', failed: (status: number) => status === 401 || status === 403, form: true },
    { key: 'form-server-response', checkId: 'form-submit-api-server-error', failed: (status: number) => status >= 500, form: true },
  ]
  const probeKey = input.probe && input.probe.status > 0 ? input.probe.requestKey ?? trackingRequestKey(input.probe.url, input.probe.method) : null
  for (const policy of policies) {
    const selected = [...groups.values()].filter(group => !policy.form || group.requests[0].requestKey === probeKey)
    const failedResponse = (request: EngagementEvidence['requests'][number]) =>
      !request.responseKind && request.status !== null && policy.failed(request.status)
    for (const group of selected) {
      const failed = group.requests.some(failedResponse)
      const passed = !evidence?.truncated && group.requests.every(request => !request.responseKind &&
        request.state === 'completed' && request.status !== null && request.status >= 200 && request.status < 300)
      const outcomes = [...new Set(group.requests.map(request => request.responseKind === 'challenge' ? 'access challenge'
        : request.responseKind === 'unexpected_html' ? `HTTP ${request.status} with unexpected HTML` : request.status ?? request.state))]
      const summary = outcomes.slice(0, 8).join(', ') + (outcomes.length > 8 ? ', and other responses' : '')
      assertions.push({ key: policy.key, name: 'Engagement request response',
        expected: 'The original native request completes with a successful HTTP response under the same conditions',
        observed: `${requestLabel(group.requests[0])}: ${summary} during ${group.requests[0].phase}. ${evidence?.truncated ? 'The request limit was reached. ' : ''}This does not establish account or form completion.`,
        passed: passed && Boolean(group.context), complete: Boolean(group.context) && (failed || passed), context: group.context })
    }
    const flag = flags.find(flag => flag.checkId === policy.checkId)
    const failedGroups = selected.filter(group => group.requests.some(failedResponse))
    const failures = policy.form ? input.probe ? [input.probe] : [] : rawFailures.filter(failure => policy.failed(failure.status))
    if (flag && failedGroups.length && failedGroups.every(group => group.context) && failures.every(failure =>
      failedGroups.some(group => {
        const request = group.requests[0]
        const key = policy.form ? request.requestKey : request.redirectKey ?? request.requestKey
        return key === (failure.requestKey ?? trackingRequestKey(failure.url, failure.method))
      }))) {
      flag.verificationRule = ENGAGEMENT_VERIFICATION_RULE
      flag.evidenceTargets = failedGroups.map(group => ({ kind: 'page', source: 'measured', device: 'desktop',
        label: 'Observed engagement request', context: group.context! }))
      flag.evidence = failedGroups.map(group => `${requestLabel(group.requests[0])}: HTTP ${group.requests.map(request => request.status).join(', ')} during ${group.requests[0].phase}.`).join('\n')
    }
  }
  if (input.expected && !assertions.length) assertions.push({ key: 'engagement-observation', name: 'Original engagement request',
    expected: 'The original native request is observed again', observed: 'No matching request response was recorded. Absence does not establish recovery.', passed: false, complete: false })
  const applicable = Boolean(input.expected || evidence?.requests.length || flags.length)
  return { flags, assertions, applicable,
    complete: Boolean(evidence && !evidence.truncated && (assertions.length ? assertions.every(assertion => assertion.complete) : !applicable)),
    limitation: 'Bounded same-origin top-frame engagement requests from the existing public walk. Missing, unfinished, refused or changed requests remain unknown. Privileged operations require existing authorization. HTTP responses do not prove form success or authenticated behavior; unscoped historical and silent-feedback findings remain unverified.' }
}

/** Build a silent-failure Flag when API and UI disagree on form success. */
export function buildSilentFormFailureFlag(
  formProbe: FormProbeResult,
  reason: string
): DeterministicFlag {
  return flagBase(
    'form-submit-silent-failure',
    'Form submit succeeds without a clear success state (or shows success after a failed API)',
    `${formProbe.method} ${formProbe.status} ${formProbe.url} · ${reason}`,
    '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.'
  )
}
