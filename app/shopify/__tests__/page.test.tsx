import { beforeEach, describe, expect, it, vi } from 'vitest'

const { normalizeShopDomain, verifyShopifyOAuthHmac, isShopifyFixtureMode, signFixtureSession } = vi.hoisted(() => ({
  normalizeShopDomain: vi.fn(), verifyShopifyOAuthHmac: vi.fn(), isShopifyFixtureMode: vi.fn(), signFixtureSession: vi.fn(),
}))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))
vi.mock('@/lib/shopify/config', () => ({ normalizeShopDomain }))
vi.mock('@/lib/shopify/hmac', () => ({ verifyShopifyOAuthHmac }))
vi.mock('@/lib/shopify/fixture-session', () => ({ isShopifyFixtureMode, signFixtureSession }))
vi.mock('../ShopifyAppLoader', () => ({ ShopifyAppLoader: () => null }))
import ShopifyAppPage from '../page'

describe('Shopify embedded entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    normalizeShopDomain.mockReturnValue('demo.myshopify.com')
    verifyShopifyOAuthHmac.mockReturnValue(true)
    isShopifyFixtureMode.mockReturnValue(false)
  })
  it('sends unverified entry to the guide without loading private data', async () => {
    verifyShopifyOAuthHmac.mockReturnValue(false)
    await expect(ShopifyAppPage({ searchParams: Promise.resolve({ hmac: 'bad' }) })).rejects.toThrow('REDIRECT:/docs/integrations/shopify?error=hmac')
    expect(signFixtureSession).not.toHaveBeenCalled()
  })
  it('sends missing-store entry to the guide', async () => {
    normalizeShopDomain.mockReturnValue(null)
    await expect(ShopifyAppPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/docs/integrations/shopify')
  })
  it('provides bounded recovery for fixture entry without a store', async () => {
    normalizeShopDomain.mockReturnValue(null)
    isShopifyFixtureMode.mockReturnValue(true)
    await expect(ShopifyAppPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT:/docs/integrations/shopify?error=fixture_shop')
  })
  it('leaves private data loading to the verified-session loader', async () => {
    const page = await ShopifyAppPage({ searchParams: Promise.resolve({ shop: 'demo.myshopify.com' }) })
    expect(page.props.fixtureToken).toBeNull()
    expect(signFixtureSession).not.toHaveBeenCalled()
  })
})
