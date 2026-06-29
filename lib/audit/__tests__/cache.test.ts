import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'vitest'
import { AuditCache } from '../cache'

describe('AuditCache', () => {
  let cache: AuditCache

  beforeEach(() => {
    cache = new AuditCache(5)
  })

  it('stores and retrieves values', () => {
    cache.set('key1', { foo: 'bar' })
    const val = cache.get<{ foo: string }>('key1')
    assert.deepEqual(val, { foo: 'bar' })
  })

  it('returns null for missing keys', () => {
    assert.equal(cache.get('missing'), null)
  })

  it('respects TTL expiry', () => {
    cache.set('key1', 'value', -1)
    assert.equal(cache.get('key1'), null)
  })

  it('evicts oldest entry when over max size', () => {
    for (let i = 0; i < 5; i++) cache.set(`key${i}`, i)
    cache.set('overflow', 'value')
    assert.equal(cache.get('key0'), null, 'oldest entry evicted')
    assert.equal(cache.get('key1'), 1, 'second entry still present')
    assert.equal(cache.get('overflow'), 'value', 'new entry present')
  })

  it('delete removes a key', () => {
    cache.set('key1', 'value')
    cache.delete('key1')
    assert.equal(cache.get('key1'), null)
  })

  it('clear removes all keys', () => {
    cache.set('key1', 'value')
    cache.set('key2', 'value')
    cache.clear()
    assert.equal(cache.get('key1'), null)
    assert.equal(cache.get('key2'), null)
  })

  it('cacheKeyForPageSpeed includes url, strategy and viewport', () => {
    const key = cache.cacheKeyForPageSpeed('https://x.com', 'desktop', 'desktop')
    assert.equal(key, 'pagespeed:https://x.com:desktop:desktop')
  })

  it('cacheKeyForMetadata includes optional timestamp', () => {
    const withoutTs = cache.cacheKeyForMetadata('https://x.com')
    assert.equal(withoutTs, 'metadata:https://x.com')
    const withTs = cache.cacheKeyForMetadata('https://x.com', 123)
    assert.equal(withTs, 'metadata:https://x.com:123')
  })

  it('cacheKeyForScreenshots includes url and viewport', () => {
    const key = cache.cacheKeyForScreenshots('https://x.com', 'mobile')
    assert.equal(key, 'screenshots:https://x.com:mobile')
  })
})
