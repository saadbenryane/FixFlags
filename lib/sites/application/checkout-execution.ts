import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { runGoalProbe, type BrowserJourneyConfig, type GoalDefinition, type GoalStep } from '@/lib/integrity/run-goal-probe'
import { availabilityFlagCopy, type BindingDispositionName } from '@/lib/sites/application/binding-assessment'
import { OUTCOME_RUN_LEASE_MS } from '@/lib/sites/application/run-requests'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'
import { validateBindingConfig, type AvailabilityBindingConfig, type SafeFormBindingConfig } from '@/lib/sites/application/binding-config'
import { executeSafeFormFixture } from '@/lib/sites/application/safe-form-executor'
import { classifyWalk } from '@/lib/integrity/classify'

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
    kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'AVAILABILITY'
    bindings: Array<{
      key: string
      mechanism: OutcomeExecutionMechanism
      required: boolean
      config: Prisma.JsonValue
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
  mechanism: OutcomeExecutionMechanism
  attempts: BindingObservation[]
  conclusive: BindingObservation
}): Promise<void> {
  const { auditId, outcomeId, bindingKey, mechanism, conclusive } = input
  const execution = await prisma.outcomeBindingExecution.upsert({
    where: { auditId_outcomeId_bindingKey: { auditId, outcomeId, bindingKey } },
    create: {
      auditId,
      outcomeId,
      bindingKey,
      mechanism,
      disposition: conclusive.disposition,
      reason: conclusive.reason,
      detail: conclusive.detail,
    },
    update: {
      mechanism,
      disposition: conclusive.disposition,
      reason: conclusive.reason,
      detail: conclusive.detail,
    },
  })
  // Continue the existing sequence so a restarted worker never reuses an attempt number.
  const last = await prisma.outcomeBindingAttempt.findFirst({
    where: { auditId, outcomeId, bindingKey },
    orderBy: { attempt: 'desc' },
    select: { attempt: true },
  })
  const startAt = (last?.attempt ?? 0) + 1
  await prisma.outcomeBindingAttempt.createMany({
    data: input.attempts.map((observation, index) => ({
      auditId,
      outcomeId,
      bindingKey,
      attempt: startAt + index,
      mechanism,
      disposition: observation.disposition,
      reason: observation.reason,
      detail: observation.detail,
      executionId: execution.id,
    })),
  })
  if (input.attempts.some((observation) => observation.disposition === 'SUCCEEDED')) {
    await prisma.outcomeBindingAttempt.updateMany({
      where: { auditId, outcomeId, bindingKey, disposition: 'FAILED', transient: false },
      data: { transient: true },
    })
  }
}

/** Record one conclusive observation that required no confirmation attempt. */
async function recordExecution(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
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
    mechanism: input.mechanism,
    attempts: [observation],
    conclusive: observation,
  })
}

function buildCheckoutJourneyConfig(startUrl: string, allowLocalhost: boolean): BrowserJourneyConfig {
  const steps: GoalStep[] = [
    { action: 'wait', waitMs: 1_000 },
  ]
  const goal: GoalDefinition = {
    type: 'url_pattern',
    pattern: '/checkouts?(/|$|\\?)',
    description: 'Reach the checkout page',
  }
  return { startUrl, steps, goal, safety: 'stop-at-checkout', allowLocalhost }
}

async function runCheckoutBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
  startUrl: string
  allowLocalhost: boolean
}): Promise<void> {
  const startedAt = Date.now()
  const config = buildCheckoutJourneyConfig(input.startUrl, input.allowLocalhost)
  const result = await runGoalProbe({
    runId: `outcome-${input.runId}-${input.bindingKey}`,
    config,
  })
  const copy = checkoutResultCopy(result.reason)
  const isFlag = result.health === 'RED' && result.confirmed
  const isClear = result.health === 'GREEN' && result.confirmed
  await persistJourneyResult(input.auditId, {
    journeyType: 'checkout',
    startUrl: input.startUrl,
    status: isClear || isFlag ? 'COMPLETED' : 'ABANDONED',
    goalAchieved: isClear,
    blockedReason: isClear || isFlag ? null : result.reason,
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
            checkId: `journey-checkout-failed-${result.reason}`,
            stepNumber: Math.max(1, result.steps.length),
            url: result.finalUrl,
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'REVENUE',
            problem: copy.problem,
            evidence: copy.evidence,
            whyItMatters: 'Customers cannot complete the purchase Outcome while this failure persists.',
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
  })
  if (isFlag) {
    await prisma.flag.updateMany({
      where: { auditId: input.auditId, checkId: { startsWith: 'journey-checkout-failed-' } },
      data: { fingerprint: 'outcome:checkout' },
    })
  }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'BROWSER_JOURNEY',
    attempts: result.attempts.map((attempt): BindingObservation => {
      const classified = classifyWalk(attempt.outcome)
      return {
        disposition:
          classified.health === 'GREEN' ? 'SUCCEEDED' : classified.health === 'RED' ? 'FAILED' : 'BLOCKED',
        reason: classified.reason,
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

/** Generic browser journey runner for any goal-driven outcome (login, signup, password reset, etc.) */
async function runGenericBrowserJourneyBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
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
    mechanism: 'BROWSER_JOURNEY',
    attempts: result.attempts.map((attempt): BindingObservation => {
      const classified = classifyWalk(attempt.outcome)
      return {
        disposition:
          classified.health === 'GREEN' ? 'SUCCEEDED' : classified.health === 'RED' ? 'FAILED' : 'BLOCKED',
        reason: classified.reason,
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
  const response = await fetch(input.url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
    headers: { accept: 'text/html,application/xhtml+xml' },
  }).catch(() => null)
  if (!response) return { disposition: 'BLOCKED', reason: 'request_failed' }
  if (response.status >= 300 && response.status < 400) {
    return { disposition: 'BLOCKED', reason: 'redirect_unfollowed', detail: { status: response.status } }
  }
  const responseText = await response.text().catch(() => '')
  const botWall = /(?:captcha|cloudflare|checking your browser|access denied|verify you are human)/i.test(responseText.slice(0, 20_000))
  if (botWall) {
    return { disposition: 'BLOCKED', reason: 'bot_wall', detail: { status: response.status } }
  }
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: { htmlMetadata: true },
  })
  const metadata = audit?.htmlMetadata && typeof audit.htmlMetadata === 'object' && !Array.isArray(audit.htmlMetadata)
    ? audit.htmlMetadata as Record<string, unknown>
    : null
  if (response.ok && !metadata) {
    return { disposition: 'BLOCKED', reason: 'rendered_surface_unavailable', detail: { status: response.status } }
  }
  const pageText = typeof metadata?.pageText === 'string' ? metadata.pageText : ''
  const rendered = input.config.expectedText
    ? pageText.toLowerCase().includes(input.config.expectedText.toLowerCase())
    : input.config.expectedSelector === 'body' && pageText.trim().length > 0
  const available = response.status >= 200 && response.status < 300 && rendered
  return {
    disposition: available ? 'SUCCEEDED' : 'FAILED',
    reason: available ? 'available' : response.ok ? 'expected_surface_missing' : 'http_unavailable',
    detail: { status: response.status, rendered },
  }
}

async function runAvailabilityBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  startUrl: string
  config: AvailabilityBindingConfig
}): Promise<void> {
  const safe = normalizeAuditUrl(input.startUrl)
  if (!safe.ok) {
    await recordExecution({
      auditId: input.auditId,
      outcomeId: input.outcomeId,
      bindingKey: input.bindingKey,
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

  if (conclusive.disposition === 'FAILED') {
    const copy = availabilityFlagCopy(conclusive.reason)
    await prisma.flag.create({
      data: {
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
        fingerprint: `outcome:availability:${input.bindingKey}`,
        position: 1,
      },
    })
  }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'HTTP_AVAILABILITY',
    attempts,
    conclusive,
  })
}

async function runSignupBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  projectId: string
  config: SafeFormBindingConfig
  allowLocalhost: boolean
}): Promise<void> {
  const result = await executeSafeFormFixture({
    projectId: input.projectId,
    fixtureId: input.config.fixtureId,
    startUrl: input.config.startUrl,
    allowLocalhost: input.allowLocalhost,
  })
  // A safe form is submitted exactly once. The fixture is already proven reversible,
  // because a run that cannot prove its pre-run reset or its cleanup is BLOCKED rather
  // than FAILED, so the single attempt is conclusive and never becomes a blind resubmit.
  await recordExecution({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'SAFE_FORM',
    disposition: result.disposition,
    reason: result.reason,
    detail: result.detail,
  })
}

/** Execute every required binding selected for this Audit. Checkout is not assumed. */
export async function runBoundOutcomeExecutions(auditId: string): Promise<boolean> {
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
  const runnable = request.selections.filter((selection) => selection.outcome.bindings.length > 0)
  if (runnable.length === 0) return false

  await prisma.runRequest.updateMany({
    where: { id: request.id, status: 'QUEUED' },
    // Renew the lease on the way to RUNNING. A browser verification can outlast
    // the lease taken at creation, and a run reclaimed mid-execution would be
    // counted as in flight while the worker still owns it.
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
      leaseUntil: new Date(Date.now() + OUTCOME_RUN_LEASE_MS),
    },
  })

  const allowLocalhost = process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_CHECKOUT_FIXTURE === '1'
  for (const selection of runnable as BoundSelection[]) {
    for (const binding of selection.outcome.bindings) {
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
      const validated = validateBindingConfig(binding.mechanism, binding.config)
      if (!validated.success) {
        await recordExecution({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
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
          select: { goalAchieved: true, blockedReason: true },
        })
        if (priorJourney) {
          await recordExecution({
            auditId,
            outcomeId: selection.outcome.id,
            bindingKey: binding.key,
            mechanism: 'BROWSER_JOURNEY',
            disposition: priorJourney.goalAchieved ? 'SUCCEEDED' : priorJourney.blockedReason ? 'BLOCKED' : 'FAILED',
            reason: priorJourney.blockedReason ?? (priorJourney.goalAchieved ? 'checkout_reached' : 'checkout_failed'),
          })
          continue
        }
        await runCheckoutBinding({
          auditId,
          runId: request.id,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
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
        config: validated.data.config,
      })
    }
  }
  return true
}

export async function runBoundCheckoutForAudit(auditId: string): Promise<boolean> {
  return runBoundOutcomeExecutions(auditId)
}
