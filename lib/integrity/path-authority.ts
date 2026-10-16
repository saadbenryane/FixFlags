import type { Prisma, RevenuePath, ShopifyShop } from '@prisma/client'
import { prisma } from '@/lib/db'

export type IntegrityPathAuthority = Pick<RevenuePath, 'id' | 'shopId' | 'storefrontUrl'> & {
  shop: Pick<ShopifyShop, 'authorizationVersion' | 'projectId'>
}

/** Token renewal retains this grant; replacement and revocation rotate it. */
export function integrityPathWhere(scope: IntegrityPathAuthority): Prisma.RevenuePathWhereInput {
  return { id: scope.id, shopId: scope.shopId, storefrontUrl: scope.storefrontUrl,
    shop: { id: scope.shopId, uninstalledAt: null, authorizationVersion: scope.shop.authorizationVersion,
      encryptedAccessToken: { not: '' }, projectId: scope.shop.projectId } }
}

/** Uninstall and credential replacement serialize before path publication.
 * No browser, provider or queue operation belongs inside this transaction. */
export async function integrityPathWrite<T>(scope: IntegrityPathAuthority,
  write: (tx: Prisma.TransactionClient, path: RevenuePath, shop: ShopifyShop) => Promise<T>): Promise<T | null> {
  if (!Number.isInteger(scope.shop.authorizationVersion) || scope.shop.authorizationVersion < 1) return null
  return prisma.$transaction(async tx => {
    // Site commands lock Project before dependent records. A linked Flag joins
    // this transaction instead of creating an independent, stale projection.
    if (scope.shop.projectId) await tx.$queryRaw`SELECT id FROM projects WHERE id = ${scope.shop.projectId} FOR UPDATE`
    const [shop] = await tx.$queryRaw<ShopifyShop[]>`
      SELECT * FROM shopify_shops WHERE id = ${scope.shopId} AND "uninstalledAt" IS NULL
        AND "authorizationVersion" = ${scope.shop.authorizationVersion} AND "encryptedAccessToken" <> ''
        AND "projectId" IS NOT DISTINCT FROM ${scope.shop.projectId} FOR UPDATE
    `
    if (!shop) return null
    const [path] = await tx.$queryRaw<RevenuePath[]>`
      SELECT * FROM revenue_paths WHERE id = ${scope.id} AND "shopId" = ${scope.shopId}
        AND "storefrontUrl" = ${scope.storefrontUrl} FOR UPDATE
    `
    return path ? write(tx, path, shop) : null
  })
}
