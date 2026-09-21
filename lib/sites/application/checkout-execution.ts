import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { runPathProbe } from '@/lib/integrity/run-path-probe'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'

type CheckoutBindingConfig = { startUrl?: string }

function bindingConfig(value: Prisma.JsonValue): CheckoutBindingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const startUrl =
    'startUrl' in value && typeof value.startUrl === 'string' ? value.startUrl : undefined
  return { startUrl }
}

/** Run the Outcome-bound purchase path inside the normal Audit worker. */
export async function runBoundCheckoutForAudit(auditId: string): Promise<boolean> {
  const request = await prisma.runRequest.findFirst({
    where: { auditId, outcome: { kind: 'CHECKOUT', enabled: true } },
    include: {
      outcome: {
        include: {
          bindings: {
            where: { mechanism: 'BROWSER_JOURNEY', enabled: true },
            orderBy: { createdAt: 'asc' },
            take: 1,
          },
        },
      },
      audit: { select: { url: true } },
    },
  })
  if (!request?.audit || request.outcome.bindings.length === 0) return false

  const existing = await prisma.journeyReview.findFirst({
    where: { auditId, journeyType: 'checkout' },
    select: { id: true },
  })
  if (existing) return true

  await prisma.runRequest.updateMany({
    where: { id: request.id, status: 'QUEUED' },
    data: { status: 'RUNNING', startedAt: new Date() },
  })

  const config = bindingConfig(request.outcome.bindings[0]!.config)
  const result = await runPathProbe({
    runId: `outcome-${request.id}`,
    url: config.startUrl ?? request.audit.url,
    allowLocalhost:
      process.env.NODE_ENV !== 'production' && process.env.FIXFLAGS_CHECKOUT_FIXTURE === '1',
  })
  const copy = checkoutResultCopy(result.reason)
  const isFlag = result.health === 'RED' && result.confirmed
  const isClear = result.health === 'GREEN' && result.confirmed

  await persistJourneyResult(auditId, {
    journeyType: 'checkout',
    startUrl: config.startUrl ?? request.audit.url,
    status: isClear || isFlag ? 'COMPLETED' : 'ABANDONED',
    goalAchieved: isClear,
    blockedReason: isClear || isFlag ? null : result.reason,
    abandonedReason: isClear || isFlag ? null : copy.summary,
    durationMs: 0,
    steps: result.steps.map((step, index) => ({
      stepNumber: index + 1,
      actionType: step.label,
      actionDetail: { label: step.label },
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
            whyItMatters:
              'Customers cannot complete the purchase Outcome while this failure persists.',
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
    // The customer incident is Checkout, not a fresh issue for every URL or
    // low-level reason. Preserve the changing reason as evidence while keeping
    // one stable Site-scoped Flag identity across recurrence.
    await prisma.flag.updateMany({
      where: { auditId, checkId: { startsWith: 'journey-checkout-failed-' } },
      data: { fingerprint: 'outcome:checkout' },
    })
  }

  return true
}
