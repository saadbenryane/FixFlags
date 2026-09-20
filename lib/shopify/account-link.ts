import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'

const LINK_TTL_MS = 15 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createShopifyAccountLink(input: {
  projectId: string
  userId: string
}): Promise<string> {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  })
  if (!project) throw new Error('Site not found')

  const token = randomBytes(32).toString('base64url')
  await prisma.shopifyAccountLink.create({
    data: {
      tokenHash: hashToken(token),
      projectId: project.id,
      userId: input.userId,
      expiresAt: new Date(Date.now() + LINK_TTL_MS),
    },
  })
  return token
}

export async function accountLinkIsUsable(token: string): Promise<boolean> {
  if (!token) return false
  const link = await prisma.shopifyAccountLink.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { consumedAt: true, expiresAt: true },
  })
  return Boolean(link && !link.consumedAt && link.expiresAt > new Date())
}

export async function consumeShopifyAccountLink(input: {
  token: string
  shopDomain: string
}): Promise<{ projectId: string }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`fixflags:shopify-link:${input.shopDomain}`}, 0)
      )
    `
    const link = await tx.shopifyAccountLink.findUnique({
      where: { tokenHash: hashToken(input.token) },
      select: { id: true, projectId: true, consumedAt: true, expiresAt: true },
    })
    if (!link || link.consumedAt || link.expiresAt <= new Date()) {
      throw new Error('This Shopify connection link is invalid or expired.')
    }

    const shop = await tx.shopifyShop.findFirst({
      where: { shopDomain: input.shopDomain, uninstalledAt: null },
      select: { id: true, projectId: true },
    })
    if (!shop) throw new Error('Install FixFlags on this Shopify store before connecting it.')
    if (shop.projectId && shop.projectId !== link.projectId) {
      throw new Error('This Shopify store is already connected to another FixFlags Site.')
    }

    const occupied = await tx.shopifyShop.findFirst({
      where: { projectId: link.projectId, id: { not: shop.id } },
      select: { id: true },
    })
    if (occupied) throw new Error('This FixFlags Site already has a Shopify connection.')

    await tx.shopifyShop.update({
      where: { id: shop.id },
      data: { projectId: link.projectId, linkedAt: new Date() },
    })
    await tx.shopifyAccountLink.update({
      where: { id: link.id },
      data: { consumedAt: new Date(), shopId: shop.id },
    })
    return { projectId: link.projectId }
  })
}

export async function disconnectShopifySite(input: { projectId: string; userId: string }) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  })
  if (!project) throw new Error('Site not found')
  await prisma.shopifyShop.updateMany({
    where: { projectId: project.id },
    data: { projectId: null, linkedAt: null },
  })
}
