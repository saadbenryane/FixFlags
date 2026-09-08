import type { ShopifyProductNode } from './admin'

export interface DiscoveredPath {
  productGid: string
  label: string
  storefrontUrl: string
}

export function pickStorefrontPaths(
  products: ShopifyProductNode[],
  limit = 2
): DiscoveredPath[] {
  const candidates = products
    .filter((product) => {
      if (!product.onlineStoreUrl) return false
      return product.variants.nodes.some((variant) => variant.availableForSale)
    })
    .sort((a, b) => (b.totalInventory ?? 0) - (a.totalInventory ?? 0))
  return candidates.slice(0, limit).map((product) => ({
    productGid: product.id,
    label: product.title,
    storefrontUrl: product.onlineStoreUrl as string,
  }))
}

export function pickStorefrontPath(products: ShopifyProductNode[]): DiscoveredPath | null {
  return pickStorefrontPaths(products, 1)[0] ?? null
}
