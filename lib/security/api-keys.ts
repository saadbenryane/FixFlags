import { createHash, randomBytes } from 'node:crypto'

export const API_KEY_PREFIX = 'qos_live_'
export const MAX_ACTIVE_API_KEYS = 5

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

export function generateApiKey(): {
  rawKey: string
  keyHash: string
  prefix: string
  lastFour: string
} {
  const rawKey = `${API_KEY_PREFIX}${randomBytes(32).toString('hex')}`
  return {
    rawKey,
    keyHash: hashApiKey(rawKey),
    prefix: rawKey.slice(0, API_KEY_PREFIX.length + 4),
    lastFour: rawKey.slice(-4),
  }
}
