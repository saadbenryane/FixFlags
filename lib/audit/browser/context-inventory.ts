import type { Browser } from 'playwright'
import { auditContextDiagnostics } from './context-lifetime'

/** Aggregate the canonical native resource ledger without tracking another lifetime. */
export function browserContextInventory(browser: Browser | null | undefined, now = Date.now()) {
  const resources = auditContextDiagnostics(browser ?? null, now)
  const result = { audit: 0, inspection: 0, probe: 0, closing: 0, unattributed: resources.unownedContexts, overdue: 0 }
  for (const owner of resources.owners) {
    result[owner.scope === 'probe' ? 'probe' : owner.scope === 'standalone' ? 'inspection' : 'audit']++
    if (owner.state === 'closing' || owner.state === 'close_failed') result.closing++
    if (owner.overdue) result.overdue++
  }
  return result
}
