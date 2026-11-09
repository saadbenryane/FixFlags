import type { PublicDocument } from '../search/contracts'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { classifyPublicGet, hasSuccessfulPublicGet } from '../open-check'
import { destinationContext, displayDestination, DESTINATION_VERIFICATION_RULE } from './destination-evidence'
import { hasRepeatedRedirect } from '../redirect-evidence'
import { REDIRECT_LOOP_COPY } from '@/lib/marketing/copy/availability'
import { isPublicSignInRedirect, PUBLIC_SIGN_IN_REDIRECT } from '../browser/page-capture'
import { inspectPageResponseHeadings } from '../soft-404'

export const PAGE_RESPONSE_LIMITATION = 'The recorded public GET checks HTTP availability and explicit missing-page responses. Rendering and full page content are evaluated separately.'

/** Reuse public access policy and look for explicit missing pages in successful HTML. */
export function assessPageResponse(pageUrl: string, document?: PublicDocument | null) {
  const context = destinationContext(pageUrl, pageUrl)
  const matched = document && destinationContext(document.url, document.url) === context
  const status = matched ? document.status : null
  const redirectLoop = Boolean(matched && document.reason === 'redirect_loop' && !document.complete && document.body === null &&
    document.status !== null && !document.headers['set-cookie'] && !document.headers['cf-mitigated'] &&
    hasRepeatedRedirect({ ...document, statusCode: document.status }))
  const signInRedirect = matched && document.status !== null && (document.reason === PUBLIC_SIGN_IN_REDIRECT || isPublicSignInRedirect({
    requestedUrl: pageUrl, finalUrl: document.finalUrl, status: document.status, body: document.body ?? '',
  }))
  const boundedSample = matched && document.reason === 'document_truncated' && Boolean(document.body)
  const inspected = matched && document.status !== null && document.reason !== 'public_access_challenge' && !signInRedirect
    ? classifyPublicGet({ requestedUrl: pageUrl, finalUrl: document.finalUrl, status: document.status,
      html: document.body, wwwAuthenticate: document.headers['www-authenticate'] ?? null,
      cfMitigated: document.headers['cf-mitigated'] ?? null, httpErrorsOnly: true, bodyUnavailable: !document.complete && !boundedSample }) : null
  const successfulResponse = hasSuccessfulPublicGet(inspected && { ...inspected, status }, { allowAuthEntry: true })
  const headings = successfulResponse && status === 200 && document?.body
    ? inspectPageResponseHeadings(document.body, document.headers['content-type'], document.complete) : 'clear'
  const missingPage = headings === 'missing'
  const passed = successfulResponse && headings === 'clear'
  const failed = redirectLoop || inspected?.shouldFlagDead === true || missingPage
  const complete = passed || failed
  const interrupted = Boolean(!complete && matched && !document.complete && (
    document.reason === 'deadline_exhausted' && status === null ||
    document.reason === 'response_body_unavailable' && status === 200 && inspected?.outcome === 'unknown'))
  const responseSummary = signInRedirect ? 'The request redirected to a sign-in screen.'
    : missingPage ? 'The HTML title or main heading identifies a missing page.'
    : passed && boundedSample ? 'The HTTP response was successful. The body sample reached the collection limit.'
    : headings === 'incomplete' ? 'The body sample ended before the page title and headings could be fully checked.'
    : status === 206 ? 'The server returned only part of the requested content. Availability remains unknown.'
    : complete ? 'The public response was recorded.' : 'Access or collection limits leave the normal page response unknown.'
  const observed = redirectLoop
    ? `GET ${displayDestination(pageUrl)} repeatedly followed the same redirect route without reaching a final page response within the bounded public request.`
    : matched && document.status !== null
    ? `GET ${displayDestination(pageUrl)} returned HTTP ${document.status} at ${displayDestination(document.finalUrl)}. ${responseSummary}`
    : 'No matching public page response was recorded.'
  const assertions: CheckAssertion[] = [{ key: 'page-response', name: 'Public page response',
    expected: 'The original page responds successfully without a missing-page or server error',
    observed, passed, complete, context, ...(passed ? { pageResponseQualified: true } : {}) }]
  const flags: DeterministicFlag[] = failed ? [{ checkId: redirectLoop ? 'page-redirect-loop' : 'page-http-error', rubric: 'REACH',
    severity: 'CRITICAL', confidence: 1, source: 'DETERMINISTIC', pageUrl,
    problem: redirectLoop ? REDIRECT_LOOP_COPY.problem : missingPage ? 'This page returns a missing-page response' : `This page returns HTTP ${document!.status}`,
    evidence: observed,
    fix: redirectLoop ? REDIRECT_LOOP_COPY.fix : '1. Restore the recorded page or correct its server routing.\n2. Return a successful response for this URL, using a deliberate redirect if the page moved.\n3. Recheck this same page after the change.',
    verificationRule: DESTINATION_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'Public page response', context }],
  }] : []
  return { flags, assertions, complete, interrupted, limitation: PAGE_RESPONSE_LIMITATION, collectedAt: document?.collectedAt }
}
