import { prisma } from '@/lib/db'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { logger } from '@/lib/logger'

/** Can't buy / recovered purchase paths become the same Flag object on a matching Site. */
export async function upsertIntegritySiteFlag(input: {
  shop: { primaryUrl?: string | null; shopDomain?: string | null }
  pathId: string
  pathLabel: string
  storefrontUrl: string
  health: 'GREEN' | 'RED' | 'UNKNOWN'
  reason: string
}): Promise<{ projectId: string } | null> {
  if (input.health === 'UNKNOWN') return null
  const url = input.shop.primaryUrl || input.storefrontUrl
  const host = canonicalProductHost(url)
  if (!host) return null

  const project = await prisma.project.findFirst({
    where: { canonicalHost: host },
    select: { id: true },
  })
  if (!project) return null

  const fingerprint = `integrity:${input.pathId}`
  try {
    if (input.health === 'RED') {
      await prisma.improvement.upsert({
        where: { projectId_fingerprint: { projectId: project.id, fingerprint } },
        create: {
          projectId: project.id,
          fingerprint,
          title: `Customers can't buy: ${input.pathLabel}`,
          judgment: input.reason,
          expectedBenefit: 'Visitors can complete this purchase path.',
          recommendedChange: 'Fix the named step on the live storefront, then Verify.',
          successCondition: 'The same purchase path completes without the failed step.',
          priority: 0,
          status: 'PROPOSED',
        },
        update: {
          title: `Customers can't buy: ${input.pathLabel}`,
          judgment: input.reason,
          status: 'PROPOSED',
        },
      })
    } else {
      await prisma.improvement.updateMany({
        where: { projectId: project.id, fingerprint, status: { not: 'REJECTED' } },
        data: { status: 'VERIFIED' },
      })
    }
    return { projectId: project.id }
  } catch (error) {
    logger.warn('Integrity Site Flag sync failed', {
      pathId: input.pathId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
