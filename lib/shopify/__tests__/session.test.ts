import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { requireShopDomain } from '@/lib/shopify/session'
import { signFixtureSession, verifyFixtureSession } from '@/lib/shopify/fixture-session'

function requestWithBearer(token?: string): NextRequest {
  return new NextRequest('http://localhost/api/shopify/recheck', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
}

describe('Shopify embedded session', () => {
  it('fails closed without a bearer token', () => {
    const result = requireShopDomain(requestWithBearer())
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error.status).toBe(401)
  })

  it('rejects fixture tokens when fixture mode is off', () => {
    const previous = process.env.FIXFLAGS_SHOPIFY_FIXTURE
    process.env.FIXFLAGS_SHOPIFY_FIXTURE = ''
    const token = signFixtureSession('demo.myshopify.com')
    expect(verifyFixtureSession(token)).toBeNull()
    const result = requireShopDomain(requestWithBearer(token))
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error.status).toBe(401)
    process.env.FIXFLAGS_SHOPIFY_FIXTURE = previous
  })

  it('accepts fixture tokens only in fixture mode', () => {
    const previous = process.env.FIXFLAGS_SHOPIFY_FIXTURE
    const previousNode = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    process.env.FIXFLAGS_SHOPIFY_FIXTURE = '1'
    const token = signFixtureSession('demo.myshopify.com')
    expect(verifyFixtureSession(token)).toBe('demo.myshopify.com')
    const result = requireShopDomain(requestWithBearer(token))
    expect(result).toEqual({ shop: 'demo.myshopify.com' })
    process.env.FIXFLAGS_SHOPIFY_FIXTURE = previous
    process.env.NODE_ENV = previousNode
  })
})
