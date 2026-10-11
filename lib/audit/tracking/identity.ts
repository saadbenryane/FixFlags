import { createHash } from 'node:crypto'
import { verifierScopeKey } from '@/lib/improvements/verifier-scope'

export function trackingPageKey(pageUrl: string): string {
  return createHash('sha256').update(verifierScopeKey(pageUrl)).digest('hex')
}
