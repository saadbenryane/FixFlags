import { describe, expect, it } from 'vitest'
import { pickStorefrontPath, pickStorefrontPaths } from '../discover'
import type { ShopifyProductNode } from '../admin'

function product(
  id: string,
  title: string,
  url: string | null,
  available: boolean,
  inventory = 0
): ShopifyProductNode {
  return {
    id,
    title,
    onlineStoreUrl: url,
    totalInventory: inventory,
    variants: { nodes: [{ availableForSale: available }] },
  }
}

describe('Shopify path discovery', () => {
  it('picks the first available storefront product', () => {
    const picked = pickStorefrontPath([
      product('gid://shopify/Product/1', 'Draft', null, true),
      product('gid://shopify/Product/2', 'Sold out', 'https://store.example/p/2', false),
      product('gid://shopify/Product/3', 'Tee', 'https://store.example/p/3', true),
    ])
    expect(picked).toEqual({
      productGid: 'gid://shopify/Product/3',
      label: 'Tee',
      storefrontUrl: 'https://store.example/p/3',
    })
  })

  it('returns up to two available products, highest inventory first', () => {
    const paths = pickStorefrontPaths([
      product('gid://shopify/Product/1', 'A', 'https://store.example/a', true, 2),
      product('gid://shopify/Product/2', 'B', 'https://store.example/b', true, 40),
      product('gid://shopify/Product/3', 'C', 'https://store.example/c', true, 9),
    ])
    expect(paths).toHaveLength(2)
    expect(paths.map((path) => path.label)).toEqual(['B', 'C'])
  })

  it('returns empty when the catalog has no buyable storefront product', () => {
    expect(
      pickStorefrontPaths([
        product('gid://shopify/Product/1', 'Draft', null, true),
        product('gid://shopify/Product/2', 'Sold', 'https://store.example/p', false),
      ])
    ).toEqual([])
  })
})
