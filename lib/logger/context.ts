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
