import type { Prisma } from '@prisma/client'
import { normalizeAuditUrl, safeFetchDocument } from '@/lib/audit/url'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { PageCaptureError, publicResponseRestriction } from '@/lib/audit/browser/page-capture'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import type { AvailabilityBindingConfig } from './binding-config'
import { availabilityFlagCopy } from './binding-assessment'
import { recordBindingEvidence, recordExecution, type BindingObservation } from './binding-evidence'

/** A second independent observation confirms a failure before a customer Flag. */
const CONFIRMATION_ATTEMPTS = 2

/** One availability observation. A 200 alone is never enough: the rendered surface must match. */
async function probeAvailabilityOnce(input: {
  auditId: string
  url: string
  config: AvailabilityBindingConfig
}): Promise<BindingObservation> {
  const response = await safeFetchDocument(input.url, { timeoutMs: 8_000, deadline: Date.now() + 8000, maxBytes: 64_000 }).catch(() => null)
  if (!response) return { disposition: 'BLOCKED', reason: 'request_failed' }
  const status = response.statusCode
  if (status >= 300 && status < 400) {
    return { disposition: 'BLOCKED', reason: 'redirect_unfollowed', detail: { status } }
  }
  const restriction = publicResponseRestriction({ body: response.body, headers: response.headers, status })
  if (restriction) {
    return { disposition: 'BLOCKED', reason: restriction === 'bot_challenge' ? 'bot_wall' : 'access_restricted',
      detail: { status, restriction, url: input.url, finalUrl: response.finalUrl,
        source: 'public-http', collectedAt: new Date().toISOString() } }
  }
  if (status < 200 || status >= 300) return { disposition: 'FAILED', reason: 'http_unavailable',
    detail: { status, url: input.url, finalUrl: response.finalUrl, source: 'public-http', collectedAt: new Date().toISOString() } }
  let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
  try {
    session = await createAuditPage(await getBrowser(), input.url, { profile: DESKTOP_CAPTURE_PROFILE,
      allowLocalhost: process.env.FIXFLAGS_CHECKOUT_FIXTURE === '1', journeySafe: true, deadline: Date.now() + 12_000,
      resourcePriority: 'availability' })
    const pageText = await session.page.evaluate(() => document.body?.innerText.slice(0, 64_000) ?? '')
    const rendered = input.config.expectedText ? pageText.toLowerCase().includes(input.config.expectedText.toLowerCase())
      : input.config.expectedSelector === 'body' ? pageText.trim().length > 0
      : await session.page.locator(input.config.expectedSelector).first().isVisible()
    if (!rendered && session.safetyRestrictions?.length) return { disposition: 'BLOCKED', reason: 'protected_action_requires_fixture',
      detail: { status, restrictions: session.safetyRestrictions } }
    return { disposition: rendered ? 'SUCCEEDED' : 'FAILED', reason: rendered ? 'available' : 'expected_surface_missing',
      detail: { status, rendered, url: input.url, finalUrl: session.page.url(), source: 'public-http-and-rendered-dom', collectedAt: new Date().toISOString() } }
  } catch (error) {
    if (error instanceof PageCaptureError && ['HTTP_FORBIDDEN', 'HTTP_RATE_LIMIT'].includes(error.code))
      return { disposition: 'BLOCKED', reason: 'bot_wall', detail: { status: error.httpStatus } }
    return { disposition: 'BLOCKED', reason: 'rendered_surface_unavailable', detail: { status } }
  } finally {
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
  const safe = normalizeAuditUrl(input.startUrl)
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

  // An unavailable response is confirmed with a second request before it becomes a Flag.
  // A blocked observation is conclusive on its own, because a bot wall or an unrendered
  // surface will not resolve by asking again.
  const attempts: BindingObservation[] = []
  let conclusive = await probeAvailabilityOnce({ auditId: input.auditId, url: safe.url, config: input.config })
  attempts.push(conclusive)
  while (conclusive.disposition === 'FAILED' && attempts.length < CONFIRMATION_ATTEMPTS) {
    conclusive = await probeAvailabilityOnce({ auditId: input.auditId, url: safe.url, config: input.config })
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
