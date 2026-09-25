import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { runPathProbe } from '@/lib/integrity/run-path-probe'
import { availabilityFlagCopy, type BindingDispositionName } from '@/lib/sites/application/binding-assessment'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'

type BindingConfig = {
  startUrl?: string
  safety?: string
  authorized?: boolean
  fixture?: boolean
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

function bindingConfig(value: Prisma.JsonValue): BindingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    startUrl: typeof record.startUrl === 'string' ? record.startUrl : undefined,
    safety: typeof record.safety === 'string' ? record.safety : undefined,
    authorized: record.authorized === true,
    fixture: record.fixture === true,
  }
}

async function recordExecution(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  mechanism: OutcomeExecutionMechanism
  disposition: BindingDispositionName
  reason: string
  detail?: Prisma.InputJsonObject
}): Promise<void> {
  await prisma.outcomeBindingExecution.upsert({
    where: {
      auditId_outcomeId_bindingKey: {
        auditId: input.auditId,
        outcomeId: input.outcomeId,
        bindingKey: input.bindingKey,
      },
    },
    create: input,
    update: {},
  })
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
  const result = await runPathProbe({
    runId: `outcome-${input.runId}-${input.bindingKey}`,
    url: input.startUrl,
    allowLocalhost: input.allowLocalhost,
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
  await recordExecution({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'BROWSER_JOURNEY',
    disposition: isFlag ? 'FAILED' : isClear ? 'SUCCEEDED' : 'BLOCKED',
    reason: result.reason,
    detail: { stepCount: result.steps.length },
  })
}

async function runAvailabilityBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  startUrl: string
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
  const response = await fetch(safe.url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
    headers: { accept: 'text/html,application/xhtml+xml' },
  }).catch(() => null)
  if (!response) {
    await recordExecution({
      auditId: input.auditId,
      outcomeId: input.outcomeId,
      bindingKey: input.bindingKey,
      mechanism: 'HTTP_AVAILABILITY',
      disposition: 'BLOCKED',
      reason: 'request_failed',
    })
    return
  }
  if (response.status >= 300 && response.status < 400) {
    await recordExecution({
      auditId: input.auditId,
      outcomeId: input.outcomeId,
      bindingKey: input.bindingKey,
      mechanism: 'HTTP_AVAILABILITY',
      disposition: 'BLOCKED',
      reason: 'redirect_unfollowed',
      detail: { status: response.status },
    })
    return
  }
  const available = response.status >= 200 && response.status < 300
  if (!available) {
    const copy = availabilityFlagCopy('http_unavailable')
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
  await recordExecution({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'HTTP_AVAILABILITY',
    disposition: available ? 'SUCCEEDED' : 'FAILED',
    reason: available ? 'available' : 'http_unavailable',
    detail: { status: response.status },
  })
}

async function runSignupBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  config: BindingConfig
}): Promise<void> {
  const authorizedFixture = input.config.safety === 'reversible' && input.config.authorized === true && input.config.fixture === true
  await recordExecution({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    mechanism: 'SAFE_FORM',
    disposition: 'BLOCKED',
    reason: authorizedFixture ? 'safe_fixture_required' : 'protected_or_irreversible',
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
    data: { status: 'RUNNING', startedAt: new Date() },
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
      const config = bindingConfig(binding.config)
      const startUrl = config.startUrl ?? request.audit.url
      if (binding.mechanism === 'HTTP_AVAILABILITY' || selection.outcome.kind === 'AVAILABILITY') {
        await runAvailabilityBinding({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          startUrl,
        })
        continue
      }
      if (binding.mechanism === 'SAFE_FORM' || selection.outcome.kind === 'SIGNUP') {
        await runSignupBinding({
          auditId,
          outcomeId: selection.outcome.id,
          bindingKey: binding.key,
          config,
        })
        continue
      }
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
    }
  }
  return true
}

export async function runBoundCheckoutForAudit(auditId: string): Promise<boolean> {
  return runBoundOutcomeExecutions(auditId)
}
