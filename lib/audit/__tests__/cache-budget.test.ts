import { afterEach, expect, it, vi } from 'vitest'
import { AuditCache } from '../cache'
afterEach(() => vi.useRealTimers())
it('bounds retained raw provider payloads by bytes, independently of entry count', () => {
  const cache = new AuditCache(500, 32_000)
  for (let index = 0; index < 100; index++) cache.set(String(index), { raw: Buffer.alloc(16_000, index) }, 3600_000)
  expect(cache.diagnostics.serializedBytes).toBeLessThanOrEqual(32_000)
  expect(cache.get('0')).toBeNull(); expect(cache.get('99')).not.toBeNull()
  cache.set('oversized', Buffer.alloc(64_000))
  expect(cache.get('oversized')).toBeNull(); cache.clear()
  expect(cache.diagnostics.serializedBytes).toBe(0)
})
it('releases expired payloads without a later read of their URLs', () => {
  vi.useFakeTimers()
  const cache = new AuditCache()
  cache.set('expired-url', { raw: 'large evidence' }, 1000)
  vi.advanceTimersByTime(1001)
  expect(cache.diagnostics.entries).toBe(0)
  expect(cache.diagnostics.serializedBytes).toBe(0)
})
it('replacement accounts only for the current payload and preserves live entries', () => {
  const cache = new AuditCache(2, 10000)
  cache.set('a', { value: 1 }); cache.set('a', { value: 2 }); cache.set('b', { value: 3 })
  expect(cache.diagnostics.entries).toBe(2); expect(cache.get('a')).toEqual({ value: 2 })
  cache.clear()
})
