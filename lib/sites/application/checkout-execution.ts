import { executionWrite } from '@/lib/audit/execution-ownership'
import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { OUTCOME_RUN_LEASE_MS } from './run-requests'
import { validateBindingForOutcome } from './binding-config'
import { storedAttemptIsPurchaseWalk } from '@/lib/integrity/purchase'
import { recordExecution } from './binding-evidence'
import { runCheckoutBinding } from './checkout-binding'
import { runGenericBrowserJourneyBinding } from './browser-journey-binding'
import { runAvailabilityBinding } from './availability-binding'
import { runSignupBinding } from './signup-binding'

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
