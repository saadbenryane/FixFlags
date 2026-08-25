import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  canonicalProductHost,
  canonicalProductUrl,
  parseProductIntelligence,
  productNameFromUrl,
  type ProductIntelligence,
} from '@/lib/audit/product-intelligence'
import { assertCanCreateProduct } from '@/lib/billing/product-capacity'

const MAX_PI_MUTATION_ATTEMPTS = 5

/**
 * Resolve the one internal Product owned by this user and exact hostname.
 * Studio Projects promote this same row instead of creating a parallel record.
 */
export async function ensureProductProject(
  userId: string,
  auditUrl: string
): Promise<{ id: string; productIntelligence: ProductIntelligence | null }> {
  const canonicalHost = canonicalProductHost(auditUrl)
  if (!canonicalHost) throw new Error('A valid Product hostname is required')
  const canonicalUrl = canonicalProductUrl(auditUrl)

  const project = await prisma.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({
      where: { userId_canonicalHost: { userId, canonicalHost } },
      select: { id: true, productIntelligence: true },
    })
    if (existing) {
      return tx.project.update({
        where: { id: existing.id },
        data: { url: canonicalUrl },
        select: { id: true, productIntelligence: true },
      })
    }

    await assertCanCreateProduct(tx, userId)
    return tx.project.upsert({
      where: { userId_canonicalHost: { userId, canonicalHost } },
      create: {
        userId,
        name: productNameFromUrl(auditUrl),
        url: canonicalUrl,
        canonicalHost,
        isManaged: false,
      },
      update: { url: canonicalUrl },
      select: { id: true, productIntelligence: true },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  return {
    id: project.id,
    productIntelligence: parseProductIntelligence(project.productIntelligence),
  }
}

export async function loadProjectIntelligence(
  projectId: string
): Promise<ProductIntelligence | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { productIntelligence: true },
  })
  return parseProductIntelligence(project?.productIntelligence)
}

/**
 * The only Product Intelligence write path. Serializable read + compare-and-swap
 * prevents Contract edits, feedback, claims, and re-check learning from erasing
 * one another. Mutations are retried against the newest revision.
 */
export async function mutateProjectIntelligence(
  projectId: string,
  mutation: (current: ProductIntelligence | null) => ProductIntelligence
): Promise<ProductIntelligence> {
  for (let attempt = 0; attempt < MAX_PI_MUTATION_ATTEMPTS; attempt += 1) {
    const outcome = await prisma.$transaction(
      async (tx) => {
        const project = await tx.project.findUnique({
          where: { id: projectId },
          select: { productIntelligence: true, productIntelligenceRevision: true },
        })
        if (!project) throw new Error('Product not found')

        const next = mutation(parseProductIntelligence(project.productIntelligence))
        const updated = await tx.project.updateMany({
          where: {
            id: projectId,
            productIntelligenceRevision: project.productIntelligenceRevision,
          },
          data: {
            productIntelligence: next as unknown as Prisma.InputJsonObject,
            productIntelligenceRevision: { increment: 1 },
          },
        })
        return updated.count === 1 ? next : null
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    if (outcome) return outcome
  }

  throw new Error('Product Intelligence changed concurrently; retry the update')
}
