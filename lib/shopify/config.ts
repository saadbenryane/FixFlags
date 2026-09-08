import { getAppUrl } from '@/lib/get-app-url'

export const SHOPIFY_SCOPES = 'read_products'
export const SHOPIFY_API_VERSION = '2026-07'

export function shopifyApiKey(): string {
  return process.env.SHOPIFY_API_KEY ?? process.env.SHOPIFY_CLIENT_ID ?? ''
}

export function shopifyApiSecret(): string {
  return process.env.SHOPIFY_API_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET ?? ''
}

export function isShopifyConfigured(): boolean {
  return Boolean(shopifyApiKey() && shopifyApiSecret())
}

export function shopifyCallbackUrl(): string {
  return `${getAppUrl()}/api/shopify/callback`
}

export function shopifyInstallCtaHref(): string {
  return (
    process.env.NEXT_PUBLIC_SHOPIFY_APP_STORE_URL?.trim() ||
    '/install'
  )
}

export function normalizeShopDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!raw) return null
  const host = raw.includes('.') ? raw : `${raw}.myshopify.com`
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host)) return null
  return host
}
