import { prisma } from '@/lib/db'
import {
  canonicalProductUrl,
  parseProductIntelligence,
  productNameFromUrl,
  type ProductIntelligence,
} from '@/lib/audit/product-intelligence'

/**
 * Find or create a Project that anchors Product Intelligence for this user + host.
 * Auto-created projects are available on all plans (not gated by Agency project UI limit).
 */
export async function ensureProductProject(
  userId: string,
  auditUrl: string
): Promise<{ id: string; productIntelligence: ProductIntelligence | null }> {
  const canonical = canonicalProductUrl(auditUrl)
  const existing = await prisma.project.findFirst({
    where: {
      userId,
      OR: [{ url: canonical }, { url: { startsWith: canonical } }],
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, productIntelligence: true, url: true },
  })

  if (existing) {
    if (existing.url !== canonical) {
      await prisma.project.update({
        where: { id: existing.id },
        data: { url: canonical },
      })
    }
    return {
      id: existing.id,
      productIntelligence: parseProductIntelligence(existing.productIntelligence),
    }
  }

  const created = await prisma.project.create({
    data: {
      userId,
      name: productNameFromUrl(auditUrl),
      url: canonical,
    },
    select: { id: true, productIntelligence: true },
  })

  return {
    id: created.id,
    productIntelligence: parseProductIntelligence(created.productIntelligence),
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

export async function saveProjectIntelligence(
  projectId: string,
  pi: ProductIntelligence
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { productIntelligence: pi as object },
  })
}
