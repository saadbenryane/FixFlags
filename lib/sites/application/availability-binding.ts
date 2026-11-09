import type { Prisma } from '@prisma/client'
import type { Response } from 'playwright'
import { normalizeAuditNavigationUrl, safeFetchDocument } from '@/lib/audit/url'
import { classifyPublicRequestFailure } from '@/lib/audit/http-failure'
import { isSuccessfulPublicGetStatus, PublicResponseBodyError } from '@/lib/audit/http-evidence'
import { PublicCertificateError } from '@/lib/audit/tls-evidence'
import { PublicRedirectError } from '@/lib/audit/redirect-evidence'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { isPublicSignInRedirect, PageCaptureError, PARTIAL_PAGE_RESPONSE, publicResponseRestriction, type PublicResponseContent } from '@/lib/audit/browser/page-capture'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { isExplicitMissingPageLabel, supportsPageHeadingEvidence } from '@/lib/audit/soft-404'
import { bindingEvaluator, usesDefaultAvailabilitySurface } from '../domain/outcome-evaluation'
import type { AvailabilityBindingConfig } from './binding-config'
import { availabilityFlagCopy } from './binding-assessment'
import { recordBindingEvidence, recordExecution, type BindingObservation } from './binding-evidence'

/** A second independent observation confirms a failure before a customer Flag. */
const CONFIRMATION_ATTEMPTS = 2

/** Both public clients apply the same response policy before inspecting content. */
function availabilityResponseIssue(input: { status: number | null; headers: Record<string, string>;
  requestedUrl: string; finalUrl: string } & PublicResponseContent, defaultSurface: boolean): BindingObservation | null {
  const status = input.status
  if (status === null) return { disposition: 'BLOCKED', reason: 'response_unavailable' }
  const restriction = publicResponseRestriction({ ...input, status })
  if (restriction) return { disposition: 'BLOCKED', reason: restriction === 'bot_challenge' ? 'bot_wall' : 'access_restricted', detail: { restriction } }
  if (status >= 300 && status < 400) return { disposition: 'BLOCKED', reason: 'redirect_unfollowed' }
  if (!isSuccessfulPublicGetStatus(status)) return status === 206
    ? { disposition: 'BLOCKED', reason: 'response_unavailable' }
    : { disposition: 'FAILED', reason: 'http_unavailable' }
  return defaultSurface && isPublicSignInRedirect({ ...input, status })
    ? { disposition: 'BLOCKED', reason: 'access_restricted', detail: { restriction: 'authentication_required' } }
    : null
}

/** One availability observation. A 200 alone is never enough: the rendered surface must match. */
async function probeAvailabilityOnce(input: {
  auditId: string
  url: string
  config: AvailabilityBindingConfig
}): Promise<BindingObservation> {
  const defaultSurface = usesDefaultAvailabilitySurface(input.config)
  let attemptedOrigin: string | null = null
  let response: Awaited<ReturnType<typeof safeFetchDocument>>
  try { response = await safeFetchDocument(input.url, { timeoutMs: 8_000, deadline: Date.now() + 8000, maxBytes: 64_000,
    onHopStart: origin => { attemptedOrigin = origin } }) }
  catch (error) {
    const failure = classifyPublicRequestFailure(error)
    const partial = error instanceof PublicResponseBodyError || error instanceof PublicRedirectError ? error.response : null
    const detail = {
      status: partial?.statusCode ?? null, url: input.url,
      finalUrl: error instanceof PublicCertificateError ? error.url : partial?.finalUrl ?? attemptedOrigin ?? input.url,
      source: 'public-http', collectedAt: new Date().toISOString(),
    }
    if (error instanceof PublicResponseBodyError) {
      const issue = availabilityResponseIssue({ ...error.response, status: error.response.statusCode,
        body: error.response.body ?? '', requestedUrl: input.url }, defaultSurface)
      if (issue) return { ...issue, detail: { ...detail, ...issue.detail } }
    }
    if (failure.result !== 'FAILED') return { disposition: 'BLOCKED', reason: 'request_failed', ...(partial ? { detail } : {}) }
    return { disposition: 'FAILED', reason: failure.reason, detail }
  }
  const status = response.statusCode
  const issue = availabilityResponseIssue({ ...response, status, requestedUrl: input.url }, defaultSurface)
  if (issue) return { ...issue,
    detail: { ...issue.detail, status, url: input.url, finalUrl: response.finalUrl, source: 'public-http', collectedAt: new Date().toISOString() } }
  let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
  let navigation: { status: number; headers: Record<string, string>; url: string } | undefined
  let stopObserving: (() => void) | undefined
  try {
    session = await createAuditPage(await getBrowser(), input.url, { profile: DESKTOP_CAPTURE_PROFILE,
      allowLocalhost: process.env.FIXFLAGS_CHECKOUT_FIXTURE === '1', journeySafe: true, deadline: Date.now() + 12_000,
      resourcePriority: 'availability', retainErrorDocument: true, onNavigationStart: page => {
        const received = (result: Response) => {
          if (result.request().isNavigationRequest() && result.frame() === page.mainFrame())
            navigation = { status: result.status(), headers: result.headers(), url: result.url() }
        }
        page.on('response', received)
        stopObserving = () => { page.off('response', received) }
      } })
    const observedNavigation = navigation
    const renderedDetail = { status: observedNavigation?.status ?? null, publicHttpStatus: status, publicHttpFinalUrl: response.finalUrl,
      url: input.url, finalUrl: session.page.url(), source: 'rendered-navigation', collectedAt: new Date().toISOString() }
    const surface = await session.page.evaluate(collectMissingLabels => {
      const inactive = 'script,style,svg,template,noscript'
      const excluded = inactive + ',[hidden],[inert]'
      const text = document.body?.innerText.slice(0, 64_000) ?? ''
      const cues = { titles: [] as string[], headings: [] as string[], text }
      const missingPageLabels: string[] = []
      const labels = document.querySelectorAll('head > title, body h1')
      const limit = 100
      let labelsComplete = labels.length <= limit
      // Method syntax keeps this serialized browser callback self-contained
      // when the worker's TypeScript loader preserves function names.
      const labelReader = {
        read(label: Element, omit: string): string | null {
          const walker = document.createTreeWalker(label, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              return node instanceof Element && node.matches(omit) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
            },
          })
          let text = '', visited = 0
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (++visited > 1024) return null
            if (node.nodeType !== Node.TEXT_NODE) continue
            const value = node.nodeValue ?? ''
            if (text.length + value.length > 512) return null
            text += value
          }
          return text
        },
      }
      for (let index = 0; index < Math.min(labels.length, limit); index++) {
        const label = labels[index]
        if (label.closest(inactive)) continue
        const cue = labelReader.read(label, inactive)
        if (cue === null) labelsComplete = false
        const group = label.localName === 'title' ? cues.titles : cues.headings
        group.push(cue ?? '')
        if (!collectMissingLabels || label.closest(excluded)) continue
        const visible = label.querySelector('[hidden],[inert]') ? labelReader.read(label, excluded) : cue
        if (visible === null) labelsComplete = false
        else missingPageLabels.push(visible)
      }
      return { cues, missingPageLabels, labelsComplete, url: location.href }
    }, defaultSurface)
    const reached = new URL(surface.url), received = observedNavigation ? new URL(observedNavigation.url) : null
    reached.hash = ''; if (received) received.hash = ''
    if (!observedNavigation || navigation !== observedNavigation || !received || received.href !== reached.href || surface.url !== session.page.url() || surface.url !== renderedDetail.finalUrl)
      return { disposition: 'BLOCKED', reason: 'response_unavailable', detail: renderedDetail }
    const browserIssue = availabilityResponseIssue({ status: observedNavigation.status, cues: surface.cues, headers: observedNavigation.headers,
      requestedUrl: input.url, finalUrl: surface.url }, defaultSurface)
    if (browserIssue) return { ...browserIssue, detail: { ...renderedDetail, ...browserIssue.detail } }
    if (defaultSurface && observedNavigation.status === 200 && supportsPageHeadingEvidence(observedNavigation.headers['content-type'])) {
      if (surface.missingPageLabels.some(isExplicitMissingPageLabel)) return { disposition: 'FAILED', reason: 'missing_page', detail: renderedDetail }
      if (!surface.labelsComplete) return { disposition: 'BLOCKED', reason: 'response_unavailable', detail: renderedDetail }
    }
    const pageText = surface.cues.text
    const rendered = input.config.expectedText ? pageText.toLowerCase().includes(input.config.expectedText.toLowerCase())
      : input.config.expectedSelector === 'body' ? pageText.trim().length > 0
      : await session.page.locator(input.config.expectedSelector).first().isVisible()
    if (navigation !== observedNavigation || session.page.url() !== surface.url)
      return { disposition: 'BLOCKED', reason: 'response_unavailable', detail: renderedDetail }
    if (!rendered && session.safetyRestrictions?.length) return { disposition: 'BLOCKED', reason: 'protected_action_requires_fixture',
      detail: { ...renderedDetail, restrictions: session.safetyRestrictions } }
    return { disposition: rendered ? 'SUCCEEDED' : 'FAILED', reason: rendered ? 'available' : 'expected_surface_missing',
      detail: { ...renderedDetail, rendered, source: 'public-http-and-rendered-dom' } }
  } catch (error) {
    const detail = { status: error instanceof PageCaptureError ? error.httpStatus : session?.httpStatus ?? null,
      publicHttpStatus: status, url: input.url, finalUrl: error instanceof PageCaptureError ? error.finalUrl : null,
      source: 'rendered-navigation', collectedAt: new Date().toISOString() }
    if (error instanceof PageCaptureError && ['HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT'].includes(error.code))
      return { disposition: 'BLOCKED', reason: 'bot_wall', detail }
    if (error instanceof PageCaptureError && error.code === PARTIAL_PAGE_RESPONSE)
      return { disposition: 'BLOCKED', reason: 'response_unavailable', detail }
    return { disposition: 'BLOCKED', reason: 'rendered_surface_unavailable', detail }
  } finally {
    stopObserving?.()
    session?.disposeNetwork()
    await session?.page.context().close().catch(() => undefined)
  }
}

export async function runAvailabilityBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  startUrl: string
  config: AvailabilityBindingConfig
}): Promise<void> {
  const safe = normalizeAuditNavigationUrl(input.startUrl)
  if (!safe.ok) {
    await recordExecution({
      auditId: input.auditId,
      outcomeId: input.outcomeId,
      bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
      mechanism: 'HTTP_AVAILABILITY',
      disposition: 'BLOCKED',
      reason: 'not_public',
    })
    return
  }

  // Confirm observed failure before a Flag. An uncertain attempt stops this
  // confirmation sequence; execution recovery separately owns interruptions.
  const evaluator = bindingEvaluator('AVAILABILITY', 'HTTP_AVAILABILITY', input.config)
  const probe = async (): Promise<BindingObservation> => {
    const observation = await probeAvailabilityOnce({ auditId: input.auditId, url: safe.url, config: input.config })
    return evaluator ? { ...observation, detail: { ...observation.detail, evaluator } } : observation
  }
  const attempts: BindingObservation[] = []
  let conclusive = await probe()
  attempts.push(conclusive)
  while (conclusive.disposition === 'FAILED' && attempts.length < CONFIRMATION_ATTEMPTS) {
    conclusive = await probe()
    attempts.push(conclusive)
  }

  let failureFlag: Prisma.FlagUncheckedCreateInput | undefined
  if (conclusive.disposition === 'FAILED') {
    const copy = availabilityFlagCopy(conclusive.reason)
    failureFlag = {
        auditId: input.auditId,
        checkId: 'outcome-availability-failed',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        impactTag: 'REVENUE',
        problem: copy.problem,
        evidence: copy.evidence,
        whyItMatters: 'People cannot use this Outcome while the bound page is unavailable.',
        fix: copy.fix,
        confidence: 0.95,
        source: 'DETERMINISTIC',
        pageUrl: safe.url,
        fingerprint: outcomeFlagFingerprint(input.outcomeId, input.bindingKey),
        verificationRule: 'Repeat the same public availability binding and confirm a successful response and its expected rendered surface with matching configuration.',
        position: 1,
      }
  }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'HTTP_AVAILABILITY',
    flag: failureFlag,
    attempts,
    conclusive,
  })
}
