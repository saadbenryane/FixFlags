import { createHash } from 'node:crypto'

export function searchUrlIdentity(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.href
  } catch { return value }
}

export function searchResourceKey(url: string): string {
  return createHash('sha256').update(searchUrlIdentity(url)).digest('hex')
}
