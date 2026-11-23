import { prisma } from '@/lib/db'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { requestSiteRun } from './run-requests'
import { loadOwnedRunRequestByKey } from './run-request-keys'

export class DeployCheckRefusal extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

/**
 * Check a Site after a production deploy. Full Site scope includes eligible
 * Outcomes and open Flags. Older Outcome-only receipts remain replayable.
 */
export async function requestDeployCheck(input: { userId: string; url: string; deployment: string | null }) {
  const project = await prisma.project.findFirst({
    where: { userId: input.userId, canonicalHost: canonicalProductHost(input.url), deletedAt: null },
    select: { id: true },
  })
  if (!project) throw new DeployCheckRefusal('No owned Site matches this host.', 404)
  const identity = { projectId: project.id, userId: input.userId, source: 'DEPLOYMENT' as const }
  const idempotencyKey = input.deployment ? `deploy:${input.deployment}:site` : undefined
  if (input.deployment && idempotencyKey) {
    for (const mode of ['site', 'outcomes'] as const) {
      const recorded = await loadOwnedRunRequestByKey({ ...identity, cleanup: false,
        idempotencyKey: mode === 'site' ? idempotencyKey : `deploy:${input.deployment}:outcomes` })
      if (recorded) return { siteId: project.id, runId: recorded.id, auditId: recorded.auditId, reused: true, mode }
    }
  }
  const started = await requestSiteRun({ ...identity, outcomeIds: [], scope: 'SITE', idempotencyKey,
    context: input.deployment ? { deployment: input.deployment } : undefined })
  return { siteId: project.id, runId: started.runId, auditId: started.auditId, reused: started.reused, mode: 'site' as const }
}
