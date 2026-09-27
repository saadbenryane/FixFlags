import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'

/**
 * Shopify is a Connection and a trigger, never a second monitoring engine. An
 * install enters the same tenant-scoped run command as the Site interface, Watch,
 * a deployment, the public API, and MCP, so ownership, Outcome selection,
 * evidence, and reconciliation stay identical across every trigger.
 *
 * A shop that is not linked to a claimed Site, or a Site with no independently
 * executable Outcome, returns null. The caller keeps its own revenue-path work
 * and must not treat a missing run as a failure.
 */
export async function requestShopifyOutcomeRun(input: {
  projectId: string | null
  storefrontUrl: string
  shopDomain: string
}): Promise<{ runId: string; auditId: string | null; reused: boolean } | null> {
  if (!input.projectId) return null
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      siteOutcomes: {
        where: {
          enabled: true,
          environment: 'production',
          kind: { in: ['CHECKOUT', 'AVAILABILITY'] },
          bindings: { some: { enabled: true, required: true } },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!project || project.siteOutcomes.length === 0) return null
  return requestSiteRun({
    projectId: project.id,
    outcomeIds: project.siteOutcomes.map((outcome) => outcome.id),
    userId: project.userId,
    source: 'INTEGRATION',
    url: input.storefrontUrl,
    context: { action: 'shopify_install', shop: input.shopDomain },
  })
}
