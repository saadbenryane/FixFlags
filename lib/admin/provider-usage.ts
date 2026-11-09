import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import type { AdminActor } from '@/lib/auth/require-admin'
import type { ProviderUsageAdmission } from '@/lib/audit/provider-usage'
import { reserveProviderBudget, settleProviderBudget } from '@/lib/billing/provider-budget'
import { priceProviderMeasurement } from '@/lib/billing/provider-pricing'
import { assertAdminActor, revisionHash } from './security'
import { appendAdminActivity } from './activity'

/** The live read-only credential probe owns an operator operation, without
 * granting the generic mutation dispatcher permission to replay paid probes. */
export function adminProviderUsage(actor: AdminActor): ProviderUsageAdmission {
  return async (model, bound) => {
    if (bound.model !== model) throw new Error('Administrator request model does not match its admission')
    const id = randomUUID(), token = randomUUID(), startedAt = new Date()
    const { model: _model, ...request } = bound
    void _model
    const admitted = await prisma.$transaction(async tx => {
      await assertAdminActor(tx, actor)
      const budget = await reserveProviderBudget(tx, { runId: `probe:${id}`, siteId: null }, bound)
      const receipt = { version: 1, model, request, budget, usage: null, estimatedCostUsd: null }
      const operation = await tx.adminOperation.create({ data: { id, action: 'AI_PROVIDER_VALIDATE',
        actorId: actor.id, actorSessionId: actor.sessionId, actorAuthenticatedAt: actor.authenticatedAt,
        targetType: 'AI_PROVIDER', targetId: model, reason: 'Validate the configured inference credential.',
        input: { model, api: bound.api }, expectedRevision: revisionHash({ model, api: bound.api }),
        idempotencyKey: id, requestHash: bound.bodySha256, intentExpiresAt: new Date(startedAt.getTime() + 60_000),
        status: 'RUNNING', executionToken: token, leaseUntil: new Date(startedAt.getTime() + 60_000), attempts: 1, result: receipt } })
      await appendAdminActivity(tx, operation, 'provider_request_admitted', { model, api: bound.api, bodySha256: bound.bodySha256 })
      return { operation, receipt }
    })
    return async usage => prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM admin_operations WHERE id=${id} AND "executionToken"=${token} AND status='RUNNING' FOR UPDATE`
      if (rows.length !== 1) return
      const estimatedCostUsd = usage ? priceProviderMeasurement(usage, bound.pricing) : null
      await settleProviderBudget(tx, admitted.receipt.budget, estimatedCostUsd)
      await tx.adminOperation.update({ where: { id }, data: { status: usage ? 'SUCCEEDED' : 'INDETERMINATE',
        executionToken: null, leaseUntil: null, completedAt: new Date(),
        result: { ...admitted.receipt, usage, estimatedCostUsd } } })
      await appendAdminActivity(tx, admitted.operation, usage ? 'provider_usage_measured' : 'provider_usage_unknown',
        { model: usage?.model ?? model, estimatedCostUsd })
    })
  }
}
