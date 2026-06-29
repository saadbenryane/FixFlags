interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class AuditCache {
  private cache: Map<string, CacheEntry<unknown>>
  private maxSize: number

  constructor(maxSize: number = 500) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) this.cache.delete(firstKey)
    }

    const ttl = ttlMs ?? 24 * 60 * 60 * 1000
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

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
