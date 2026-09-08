import { SHOPIFY_API_VERSION } from './config'
import { getValidOfflineToken } from './tokens'

export async function shopifyAdminGraphql<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify(variables ? { query, variables } : { query }),
  })
  if (!response.ok) {
    throw new Error(`Shopify GraphQL failed (${response.status})`)
  }
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '))
  }
  if (!payload.data) throw new Error('Shopify GraphQL returned no data')
  return payload.data
}

export async function shopifyAdminGraphqlForShop<T>(
  shop: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const accessToken = await getValidOfflineToken(shop)
  return shopifyAdminGraphql<T>(shop, accessToken, query, variables)
}

export interface ShopifyProductNode {
  id: string
  title: string
  onlineStoreUrl: string | null
  totalInventory: number | null
  variants: { nodes: Array<{ availableForSale: boolean }> }
}

export interface ShopifyShopQuery {
  shop: {
    name: string
    email: string | null
    myshopifyDomain: string
    primaryDomain: { url: string } | null
  }
  products: { nodes: ShopifyProductNode[] }
}

export const SHOP_AND_PRODUCTS_QUERY = `{
  shop { name email myshopifyDomain primaryDomain { url } }
  products(first: 25, query: "status:active") {
    nodes {
      id
      title
      onlineStoreUrl
      totalInventory
      variants(first: 20) { nodes { availableForSale } }
    }
  }
}`
