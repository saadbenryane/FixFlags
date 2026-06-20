import { AsyncLocalStorage } from 'node:async_hooks'

export interface LoggerContext {
  auditId?: string
  requestId?: string
  userId?: string
  [key: string]: unknown
}

const storage = new AsyncLocalStorage<LoggerContext>()

export function getCurrentContext(): LoggerContext {
  return storage.getStore() ?? {}
}

export function runWithContext<T>(ctx: LoggerContext, fn: () => T): T {
  const parent = storage.getStore()
  const merged = parent ? { ...parent, ...ctx } : ctx
  return storage.run(merged, fn)
}
