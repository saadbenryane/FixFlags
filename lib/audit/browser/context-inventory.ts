import type { Browser, BrowserContext } from 'playwright'

export type BrowserContextOwner = 'audit' | 'inspection' | 'probe'
type ContextRecord = { owner: BrowserContextOwner; deadline: number | null; closingAt: number | null }
const contexts = new WeakMap<BrowserContext, ContextRecord>()
const CLOSE_GRACE_MS = 30_000

/** Retain physical ownership until Chromium removes the context. No URLs or credentials. */
export function registerBrowserContext(context: BrowserContext, owner: BrowserContextOwner, deadline?: number) {
  const record: ContextRecord = { owner, deadline: Number.isFinite(deadline) ? deadline! : null, closingAt: null }
  contexts.set(context, record)
  const close = context.close.bind(context)
  context.close = (...args) => {
    record.closingAt ??= Date.now()
    return close(...args)
  }
}

export function browserContextInventory(browser: Browser | null | undefined, now = Date.now()) {
  const result = { audit: 0, inspection: 0, probe: 0, closing: 0, unattributed: 0, overdue: 0 }
  if (!browser?.isConnected()) return result
  for (const context of browser.contexts()) {
    const record = contexts.get(context)
    if (!record) { result.unattributed++; continue }
    result[record.owner]++
    if (record.closingAt !== null) result.closing++
    const due = record.closingAt ?? record.deadline
    if (due !== null && now > due + CLOSE_GRACE_MS) result.overdue++
  }
  return result
}
