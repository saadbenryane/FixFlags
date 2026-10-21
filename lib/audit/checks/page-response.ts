import type { PublicDocument } from '../search/contracts'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { classifyPublicGet } from '../open-check'
import { destinationContext, displayDestination, DESTINATION_VERIFICATION_RULE } from './destination-evidence'
import { hasRepeatedRedirect } from '../redirect-evidence'
import { REDIRECT_LOOP_COPY } from '@/lib/marketing/copy/availability'

export const PAGE_RESPONSE_LIMITATION = 'The recorded public GET response establishes HTTP availability only. Rendering, access restrictions and unavailable response bodies remain separate.'

/** Reuse the collected response and public-link policy, including challenge refusal. */
export function assessPageResponse(pageUrl: string, document?: PublicDocument | null) {
  const context = destinationContext(pageUrl, pageUrl)
  const matched = document && destinationContext(document.url, document.url) === context
  const status = matched ? document.status : null
  const redirectLoop = Boolean(matched && document.reason === 'redirect_loop' && !document.complete && document.body === null &&
    document.status !== null && !document.headers['set-cookie'] && !document.headers['cf-mitigated'] &&
    hasRepeatedRedirect({ ...document, statusCode: document.status }))
  const inspected = matched && document.complete && document.status !== null && document.reason !== 'public_access_challenge'
    ? classifyPublicGet({ requestedUrl: pageUrl, finalUrl: document.finalUrl, status: document.status,
      html: document.body, wwwAuthenticate: document.headers['www-authenticate'] ?? null,
      cfMitigated: document.headers['cf-mitigated'] ?? null, httpErrorsOnly: true }) : null
  const passed = Boolean(inspected && status !== null && status >= 200 && status < 300 &&
    ['reachable', 'redirected', 'auth_required'].includes(inspected.outcome))
  const failed = redirectLoop || inspected?.shouldFlagDead === true
  const complete = passed || failed
  const observed = redirectLoop
    ? `GET ${displayDestination(pageUrl)} repeatedly followed the same redirect route without reaching a final page response within the bounded public request.`
    : matched && document.status !== null
    ? `GET ${displayDestination(pageUrl)} returned HTTP ${document.status} at ${displayDestination(document.finalUrl)}. ${complete ? 'The public response was recorded.' : 'Access or collection limits leave the normal page response unknown.'}`
    : 'No matching public page response was recorded.'
  const assertions: CheckAssertion[] = [{ key: 'page-response', name: 'Public page response',
    expected: 'The original page responds successfully without a missing-page or server error',
    observed, passed, complete, context }]
  const flags: DeterministicFlag[] = failed ? [{ checkId: redirectLoop ? 'page-redirect-loop' : 'page-http-error', rubric: 'REACH',
    severity: 'CRITICAL', confidence: 1, source: 'DETERMINISTIC', pageUrl,
    problem: redirectLoop ? REDIRECT_LOOP_COPY.problem : `This page returns HTTP ${document!.status}`,
    evidence: observed,
    fix: redirectLoop ? REDIRECT_LOOP_COPY.fix : '1. Restore the recorded page or correct its server routing.\n2. Return a successful response for this URL, using a deliberate redirect if the page moved.\n3. Recheck this same page after the change.',
    verificationRule: DESTINATION_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'Public page response', context }],
  }] : []
  return { flags, assertions, complete, limitation: PAGE_RESPONSE_LIMITATION, collectedAt: document?.collectedAt }
}
