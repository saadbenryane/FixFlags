import { serialize } from 'node:v8'

interface CacheEntry<T> {
  value: T
  expiresAt: number
  bytes: number
}

export class AuditCache {
  private cache: Map<string, CacheEntry<unknown>>
  private maxSize: number
  private bytes = 0
  private expiryTimer?: ReturnType<typeof setTimeout>

  constructor(maxSize: number = 500, private readonly maxBytes = 16 * 1024 * 1024) {
    if (!Number.isInteger(maxSize) || maxSize < 1 || !Number.isFinite(maxBytes) || maxBytes < 1) throw new Error('Invalid cache budget')
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const now = Date.now()
    for (const [expiredKey, entry] of this.cache) if (entry.expiresAt <= now) this.delete(expiredKey)
    this.delete(key)
    // Lighthouse results can include multi-megabyte raw traces. Entry count
    // alone cannot bound how much evidence a long-lived worker retains.
    let bytes: number
    try { bytes = serialize(value).byteLength } catch { return }
    const ttl = ttlMs ?? 24 * 60 * 60 * 1000
    if (bytes > this.maxBytes || ttl <= 0 || !Number.isFinite(ttl)) return
    while (this.cache.size >= this.maxSize || this.bytes + bytes > this.maxBytes) {
      const firstKey = this.cache.keys().next().value
      if (firstKey === undefined) break
      this.delete(firstKey)
    }

    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      bytes,
    })
    this.bytes += bytes
    this.scheduleExpiry()
  }

  delete(key: string): void {
    const entry = this.cache.get(key)
    if (entry) this.bytes -= entry.bytes
    this.cache.delete(key)
    if (!this.cache.size) { clearTimeout(this.expiryTimer); this.expiryTimer = undefined }
  }

  clear(): void {
    this.cache.clear()
    this.bytes = 0
    clearTimeout(this.expiryTimer); this.expiryTimer = undefined
  }

  private scheduleExpiry() {
    if (this.expiryTimer) return
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = undefined
      const now = Date.now()
      for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.delete(key)
      if (this.cache.size) this.scheduleExpiry()
    }, Math.min(60_000, Math.max(1, Math.min(...[...this.cache.values()].map(entry => entry.expiresAt)) - Date.now())))
    this.expiryTimer.unref?.()
  }

  get diagnostics() { return { entries: this.cache.size, serializedBytes: this.bytes, maxBytes: this.maxBytes } }

  cacheKeyForPageSpeed(url: string, strategy: string, viewport: string): string {
    return `pagespeed:${url}:${strategy}:${viewport}`
  }

  cacheKeyForMetadata(url: string, timestamp?: number): string {
    return timestamp ? `metadata:${url}:${timestamp}` : `metadata:${url}`
  }

  cacheKeyForScreenshots(url: string, viewport: string): string {
    return `screenshots:${url}:${viewport}`
  }
}

export const auditCache = new AuditCache()
