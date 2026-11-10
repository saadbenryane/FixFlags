import { prisma } from '@/lib/db'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { requestSiteRun } from './run-requests'

export class DeployCheckRefusal extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

/**
 * Check a Site after a production deploy. Confirmed Outcomes are verified when the Site has
 * them; otherwise the whole Site is checked again, which also rechecks its open Flags. One
 * deployment id starts at most one run.
 */
export async function requestDeployCheck(input: { userId: string; url: string; deployment: string | null }) {
  const project = await prisma.project.findFirst({
    where: { userId: input.userId, canonicalHost: canonicalProductHost(input.url), deletedAt: null },
    select: { id: true, siteOutcomes: { where: { enabled: true }, select: { id: true }, orderBy: { id: 'asc' } } },
  })
  if (!project) throw new DeployCheckRefusal('No owned Site matches this host.', 404)
  const outcomeIds = project.siteOutcomes.map(outcome => outcome.id)
  const mode = outcomeIds.length > 0 ? 'outcomes' as const : 'site' as const
  const idempotencyKey = input.deployment ? `deploy:${input.deployment}:${mode}` : undefined
  const started = mode === 'outcomes'
    ? await requestSiteRun({ projectId: project.id, outcomeIds, userId: input.userId, source: 'DEPLOYMENT', idempotencyKey, url: input.url,
        context: input.deployment ? { deployment: input.deployment } : undefined })
    : await requestSiteRun({ projectId: project.id, outcomeIds: [], scope: 'SITE', userId: input.userId, source: 'DEPLOYMENT', idempotencyKey,
        context: input.deployment ? { deployment: input.deployment } : undefined })
  return { siteId: project.id, runId: started.runId, auditId: started.auditId, reused: started.reused, mode }
}
