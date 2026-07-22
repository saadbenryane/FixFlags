import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import {
  canonicalProductUrl,
  parseProductIntelligence,
  productNameFromUrl,
  type ProductIntelligence,
} from '@/lib/audit/product-intelligence'

/**
 * Find or create a Project that anchors Product Intelligence for this user + host.
 * Auto-created anchors set `isAnchor` and do not consume Agency project UI slots.
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

  let created: { id: string; productIntelligence: unknown }
  try {
    created = await prisma.project.create({
      data: {
        userId,
        name: productNameFromUrl(auditUrl),
        url: canonical,
        isAnchor: true,
      },
      select: { id: true, productIntelligence: true },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error
    }
    const concurrent = await prisma.project.findFirst({
      where: { userId, url: canonical, isAnchor: true },
      select: { id: true, productIntelligence: true },
    })
    if (!concurrent) throw error
    created = concurrent
  }

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
