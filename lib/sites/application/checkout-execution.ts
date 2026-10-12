import { executionWrite, executionTransaction, currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { safeFetchDocument } from '@/lib/audit/url'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { PageCaptureError, isBotInterstitialDocument } from '@/lib/audit/browser/page-capture'
import { TaskFailure } from '@/lib/audit/progressive/contracts'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { runGoalProbe, type BrowserJourneyConfig } from '@/lib/integrity/run-goal-probe'
import { runPathProbe } from '@/lib/integrity/run-path-probe'
import { availabilityFlagCopy, safeFormFlagCopy, type BindingDispositionName } from '@/lib/sites/application/binding-assessment'
import { OUTCOME_RUN_LEASE_MS } from '@/lib/sites/application/run-requests'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'
import { validateBindingForOutcome, type AvailabilityBindingConfig, type SafeFormBindingConfig } from '@/lib/sites/application/binding-config'
import { executeSafeFormFixture } from '@/lib/sites/application/safe-form-executor'
import { classifyWalk, goalProbeReason } from '@/lib/integrity/classify'
import {
  checkoutAttemptObservation,
  checkoutProbeVerdict,
  storedAttemptIsPurchaseWalk,
} from '@/lib/integrity/purchase'

/** A bounded second attempt is required before a failure becomes a customer Flag. */
const CONFIRMATION_ATTEMPTS = 2

type BindingObservation = {
  disposition: BindingDispositionName
  reason: string
  detail?: Prisma.InputJsonObject
}

type BoundSelection = {
  outcome: {
    id: string
    kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'
    bindings: Array<{
      key: string
      version: number
      mechanism: OutcomeExecutionMechanism
      required: boolean
      config: Prisma.JsonValue
      fixture?: { id: string; version: number }
      configurationError?: string
    }>
  }
}

/**
 * Persist the conclusive verdict as the latest-attempt projection and append every
 * confirmation attempt that produced it. A failure a later attempt recovered stays
 * recorded and is marked transient, so flakiness remains diagnosable instead of
 * being overwritten, and it never reaches the customer as a Flag.
 */
async function recordBindingEvidence(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  mechanism: OutcomeExecutionMechanism
  attempts: BindingObservation[]
  conclusive: BindingObservation
  flag?: Prisma.FlagUncheckedCreateInput
  failureFlagId?: string
}): Promise<void> {
  const { auditId, outcomeId, bindingKey, mechanism, conclusive } = input
  if (currentExecutionOwnership()?.taskId && ['request_failed', 'rendered_surface_unavailable', 'form_execution_failed', 'probe_error'].includes(conclusive.reason)) {
    await executionWrite(tx => tx.auditPipelineEvent.create({ data: {
      auditId, executionId: currentExecutionOwnership()!.taskId!, traceId: auditId,
      attempt: currentExecutionOwnership()!.generation, stage: 'checking', event: 'binding_attempt_interrupted', status: 'partial',
      detail: { version: 1, outcomeId, bindingKey, bindingVersion: input.bindingVersion ?? null, observations: input.attempts as Prisma.InputJsonValue },
    } }))
    throw new TaskFailure('BINDING_EXECUTION_INTERRUPTED', true)
  }
  await executionTransaction(async tx => {
  await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
  const existing = await tx.outcomeBindingExecution.findUnique({
    where: { auditId_outcomeId_bindingKey: { auditId, outcomeId, bindingKey } }, select: { id: true },
  })
  if (existing) return
  const generation = currentExecutionOwnership()?.generation
  const flag = input.flag ? await tx.flag.create({ data: input.flag }) : null
  const failureFlagId = flag?.id ?? input.failureFlagId
  const execution = await tx.outcomeBindingExecution.create({
    data: {
      auditId,
      outcomeId,
      bindingKey,
      mechanism,
      disposition: conclusive.disposition,
      reason: conclusive.reason,
      detail: failureFlagId ? { ...conclusive.detail, failureFlagId } : conclusive.detail,
      bindingVersion: input.bindingVersion,
      executionGeneration: generation,
    },
  })
  // Continue the existing sequence so a restarted worker never reuses an attempt number.
  const last = await tx.outcomeBindingAttempt.findFirst({
    where: { auditId, outcomeId, bindingKey },
    orderBy: { attempt: 'desc' },
    select: { attempt: true },
  })
  const startAt = (last?.attempt ?? 0) + 1
  await tx.outcomeBindingAttempt.createMany({
    data: input.attempts.map((observation, index) => ({
      auditId,
      outcomeId,
      bindingKey,
      attempt: startAt + index,
      bindingVersion: input.bindingVersion,
      executionGeneration: generation,
      mechanism,
      disposition: observation.disposition,
      reason: observation.reason,
      detail: observation.detail,
      executionId: execution.id,
    })),
  })
  if (input.attempts.some((observation) => observation.disposition === 'SUCCEEDED')) {
    await tx.outcomeBindingAttempt.updateMany({
      where: { auditId, outcomeId, bindingKey, disposition: 'FAILED', transient: false },
      data: { transient: true },
    })
  }
  await tx.auditPipelineEvent.create({ data: {
    auditId, executionId: execution.id, traceId: auditId, attempt: startAt,
    stage: 'checking', event: 'binding_observation_committed', status: 'completed',
    detail: { version: 1, outcomeId, bindingKey, bindingVersion: input.bindingVersion ?? null,
      generation: generation ?? null, observations: input.attempts as Prisma.InputJsonValue },
  } })
  })
}

/** Record one conclusive observation that required no confirmation attempt. */
async function recordExecution(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  mechanism: OutcomeExecutionMechanism
  disposition: BindingDispositionName
  reason: string
  detail?: Prisma.InputJsonObject
}): Promise<void> {
  const observation: BindingObservation = {
    disposition: input.disposition,
    reason: input.reason,
    detail: input.detail,
  }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: input.mechanism,
    attempts: [observation],
    conclusive: observation,
  })
}

async function runCheckoutBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  startUrl: string
  allowLocalhost: boolean
}): Promise<void> {
  const startedAt = Date.now()
  const result = await runPathProbe({
    runId: `outcome-${input.runId}-${input.bindingKey}-g${currentExecutionOwnership()?.generation ?? 0}`,
    url: input.startUrl,
    allowLocalhost: input.allowLocalhost,
  })
  const verdict = checkoutProbeVerdict(result)
  const copy = checkoutResultCopy(verdict.reason)
  const isFlag = verdict.isFlag
  const isClear = verdict.isClear
  await persistJourneyResult(input.auditId, {
    journeyType: 'checkout',
    startUrl: input.startUrl,
    status: isClear || isFlag ? 'COMPLETED' : 'ABANDONED',
    goalAchieved: isClear,
    blockedReason: isClear || isFlag ? null : verdict.reason,
    abandonedReason: isClear || isFlag ? null : copy.summary,
    durationMs: Date.now() - startedAt,
    steps: result.steps.map((step, index) => ({
      stepNumber: index + 1,
      actionType: step.label,
      actionDetail: { label: step.label, bindingKey: input.bindingKey },
      url: step.url,
      screenshotAfterUrl: step.screenshotUrl,
      accessibilityTree: '',
      outcomeMatch: step.label === 'checkout' ? isClear : null,
      outcomeDetail: index === result.steps.length - 1 ? copy.evidence : null,
      reasoning: `Independent Checkout verification: ${step.label}`,
    })),
    findings: isFlag
      ? [
          {
            checkId: `journey-checkout-failed-${verdict.reason}`,
            stepNumber: Math.max(1, result.steps.length),
            url: result.finalUrl,
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'REVENUE',
            problem: copy.problem,
            evidence: copy.evidence,
            whyItMatters: 'Customers can’t reach checkout while this problem persists.',
            fix: copy.fix,
            screenshotUrl: result.steps.at(-1)?.screenshotUrl ?? null,
            confidence: 0.95,
            findingType: 'dead-end',
          },
        ]
      : [],
    actionTimeline: result.steps.map((step, index) => ({
      t: index,
      kind: 'checkout',
      label: step.label,
      url: step.url,
      screenshot: step.screenshotUrl,
    })),
  }, { outcomeId: input.outcomeId, bindingKey: input.bindingKey })
  const failure = isFlag ? await prisma.flag.findFirst({ where: { auditId: input.auditId,
    fingerprint: outcomeFlagFingerprint(input.outcomeId, input.bindingKey) }, select: { id: true } }) : null
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'BROWSER_JOURNEY',
    failureFlagId: failure?.id,
    attempts: result.attempts.map((attempt): BindingObservation => {
      const observation = checkoutAttemptObservation(attempt)
      return {
        disposition: observation.disposition,
        reason: observation.reason,
        detail: { stepCount: attempt.steps.length, videoUrl: attempt.videoUrl, httpStatus: attempt.outcome.httpStatus, finalUrl: attempt.finalUrl },
      }
    }),
    conclusive: {
      disposition: verdict.disposition,
      reason: verdict.reason,
      detail: { stepCount: result.steps.length },
    },
  })
}

/** Generic browser journey runner for any goal-driven outcome (login, signup, password reset, etc.) */
async function runGenericBrowserJourneyBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  config: BrowserJourneyConfig
}): Promise<void> {
  const result = await runGoalProbe({
    runId: `outcome-${input.runId}-${input.bindingKey}`,
    config: input.config,
  })
  const isFlag = result.health === 'RED' && result.confirmed
  const isClear = result.health === 'GREEN' && result.confirmed
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'BROWSER_JOURNEY',
    attempts: result.attempts.map((attempt): BindingObservation => {
      const classified = classifyWalk(attempt.outcome)
      return {
        disposition:
          classified.health === 'GREEN' ? 'SUCCEEDED' : classified.health === 'RED' ? 'FAILED' : 'BLOCKED',
        reason: goalProbeReason(classified, input.config.safety),
        detail: { stepCount: attempt.steps.length, videoUrl: attempt.videoUrl },
      }
    }),
    conclusive: {
      disposition: isFlag ? 'FAILED' : isClear ? 'SUCCEEDED' : 'BLOCKED',
      reason: result.reason,
      detail: { stepCount: result.steps.length },
    },
  })
}

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
  if (isBotInterstitialDocument({ body: response.body, headers: response.headers, status })) {
    return { disposition: 'BLOCKED', reason: 'bot_wall', detail: { status } }
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

async function runAvailabilityBinding(input: {
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

async function runSignupBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  projectId: string
  config: SafeFormBindingConfig
  fixtureVersion?: number
  allowLocalhost: boolean
}): Promise<void> {
  const result = await executeSafeFormFixture({
    projectId: input.projectId,
    fixtureId: input.config.fixtureId,
    expectedVersion: input.fixtureVersion,
    startUrl: input.config.startUrl,
    allowLocalhost: input.allowLocalhost,
  })
  // A safe form is submitted exactly once. The fixture is already proven reversible,
  // because a run that cannot prove its pre-run reset or its cleanup is BLOCKED rather
  // than FAILED, so the single attempt is conclusive and never becomes a blind resubmit.
  const copy = result.disposition === 'FAILED' ? safeFormFlagCopy(result.reason) : null
  const observation: BindingObservation = { disposition: result.disposition, reason: result.reason, detail: result.detail }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'SAFE_FORM',
    attempts: [observation],
    conclusive: observation,
    flag: copy ? { auditId: input.auditId, checkId: 'outcome-signup-failed', rubric: 'EXPERIENCE', severity: 'CRITICAL', impactTag: 'CONVERSION',
      problem: copy.problem, evidence: copy.evidence, fix: copy.fix,
      whyItMatters: 'People may be unable to complete signup while its completion response is missing.',
      confidence: 0.95, source: 'DETERMINISTIC', pageUrl: input.config.startUrl,
      fingerprint: outcomeFlagFingerprint(input.outcomeId, input.bindingKey), position: 1,
      verificationRule: 'Run the same authorized fixture version and required bindings. Confirm a new success signal after submission, with proven reset and cleanup.',
    } : undefined,
  })
}

/** Execute every required binding selected for this Audit. Checkout is not assumed. */
export async function runBoundOutcomeExecutions(auditId: string, only?: { outcomeId: string; bindingKey: string }): Promise<boolean> {
  const request = await prisma.runRequest.findFirst({
    where: { auditId, status: { in: ['QUEUED', 'RUNNING'] } },
    include: {
      selections: {
        include: {
          outcome: {
            include: {
              bindings: {
                where: { enabled: true, required: true },
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
      audit: { select: { url: true } },
    },
  })
  if (!request?.audit || request.selections.length === 0) return false
  const spec = readExecutionSpec(request.executionSpec)
  if (request.executionSpec != null && !spec) throw new Error('Invalid admitted execution specification')
  // Unversioned requests are historical compatibility only. New requests always
  // execute the admitted snapshot, never mutable binding configuration.
  const selections: BoundSelection[] = spec
    ? spec.outcomes.map(outcome => ({ outcome: {
        id: outcome.id, kind: outcome.kind as BoundSelection['outcome']['kind'],
        bindings: outcome.bindings.filter(binding => binding.required).map(binding => ({
          ...binding, config: binding.config as Prisma.JsonValue,
        })),
      } }))
    : request.selections
  const runnable = selections.filter(selection => selection.outcome.bindings.length > 0)
  if (runnable.length === 0) return false

  await executionWrite(tx => tx.runRequest.updateMany({
    where: { id: request.id, status: 'QUEUED' },
    // Renew the lease on the way to RUNNING. A browser verification can outlast
    // the lease taken at creation, and a run reclaimed mid-execution would be
    // counted as in flight while the worker still owns it.
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      leaseUntil: new Date(Date.now() + OUTCOME_RUN_LEASE_MS),
    },
  }))

  const allowLocalhost = process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_CHECKOUT_FIXTURE === '1'
  for (const selection of runnable as BoundSelection[]) {
    for (const binding of selection.outcome.bindings) {
      if (only && (selection.outcome.id !== only.outcomeId || binding.key !== only.bindingKey)) continue
      const existing = await prisma.outcomeBindingExecution.findUnique({
        where: {
          auditId_outcomeId_bindingKey: {
            auditId,
            outcomeId: selection.outcome.id,
            bindingKey: binding.key,
          },
        },
        select: { id: true },
      })
      if (existing) continue
      const currentBinding = request.selections.find(candidate => candidate.outcome.id === selection.outcome.id)?.outcome.bindings.find(current => current.key === binding.key)
      if (spec && (!currentBinding || !currentBinding.enabled || currentBinding.version !== binding.version)) {
        await recordExecution({ auditId, outcomeId: selection.outcome.id, bindingKey: binding.key,
          bindingVersion: binding.version, mechanism: binding.mechanism, disposition: 'BLOCKED', reason: 'binding_changed' })
        continue
      }
      if (binding.configurationError) {
        await recordExecution({ auditId, outcomeId: selection.outcome.id, bindingKey: binding.key,
          bindingVersion: binding.version, mechanism: binding.mechanism, disposition: 'BLOCKED', reason: binding.configurationError })
        continue
      }
      const validated = validateBindingForOutcome(selection.outcome.kind, binding.mechanism, binding.config)
      if (!validated.success) {
        await recordExecution({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          bindingVersion: binding.version,
          mechanism: binding.mechanism,
          disposition: 'BLOCKED',
          reason: validated.reason,
        })
        continue
      }
      const config = validated.data.config
      const startUrl = config.startUrl
      if (binding.mechanism === 'HTTP_AVAILABILITY' || selection.outcome.kind === 'AVAILABILITY') {
        if (validated.data.mechanism !== 'HTTP_AVAILABILITY') {
          await recordExecution({ auditId, outcomeId: selection.outcome.id, bindingKey: binding.key, mechanism: binding.mechanism, disposition: 'BLOCKED', reason: 'binding_mechanism_mismatch' })
          continue
        }
        await runAvailabilityBinding({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          bindingVersion: binding.version,
          startUrl,
          config: validated.data.config,
        })
        continue
      }
      if (binding.mechanism === 'SAFE_FORM') {
        if (validated.data.mechanism !== 'SAFE_FORM') {
          await recordExecution({ auditId, outcomeId: selection.outcome.id, bindingKey: binding.key, mechanism: binding.mechanism, disposition: 'BLOCKED', reason: 'binding_mechanism_mismatch' })
          continue
        }
        await runSignupBinding({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          bindingVersion: binding.version,
          fixtureVersion: binding.fixture?.version,
          projectId: request.projectId,
          config: validated.data.config,
          allowLocalhost,
        })
        continue
      }
      if (validated.data.mechanism !== 'BROWSER_JOURNEY') {
        await recordExecution({ auditId, outcomeId: selection.outcome.id, bindingKey: binding.key, mechanism: binding.mechanism, disposition: 'BLOCKED', reason: 'binding_mechanism_mismatch' })
        continue
      }
      // BROWSER_JOURNEY: dispatch to checkout-specific or generic runner based on outcome kind
      if (selection.outcome.kind === 'CHECKOUT') {
        const priorJourney = await prisma.journeyReview.findFirst({
          where: { auditId, journeyType: 'checkout', startUrl },
          select: {
            goalAchieved: true,
            blockedReason: true,
            steps: { select: { actionType: true, actionDetail: true, elementDescription: true } },
          },
        })
        // A wait-only review can be marked achieved by landing on checkout.
        // Reuse the stored verdict only when that review already bought.
        if (priorJourney && storedAttemptIsPurchaseWalk(priorJourney.steps)) {
          const purchased = Boolean(priorJourney.goalAchieved)
          await recordExecution({
            auditId,
            outcomeId: selection.outcome.id,
            bindingKey: binding.key,
            bindingVersion: binding.version,
            mechanism: 'BROWSER_JOURNEY',
            disposition: purchased ? 'SUCCEEDED' : priorJourney.blockedReason ? 'BLOCKED' : 'FAILED',
            reason: priorJourney.blockedReason ?? (purchased ? 'checkout_reached' : 'checkout_failed'),
          })
          continue
        }
        await runCheckoutBinding({
          auditId,
          runId: request.id,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          bindingVersion: binding.version,
          startUrl,
          allowLocalhost,
        })
        continue
      }
      // LOGIN, SIGNUP, PASSWORD_RESET, and any future browser journey kinds use the generic runner
      await runGenericBrowserJourneyBinding({
        auditId,
        runId: request.id,
        outcomeId: selection.outcome.id,
        bindingKey: binding.key,
        bindingVersion: binding.version,
        config: validated.data.config,
      })
    }
  }
  return true
}

export async function runBoundCheckoutForAudit(auditId: string): Promise<boolean> {
  return runBoundOutcomeExecutions(auditId)
}
