import pino from 'pino'
import { getCurrentContext } from './logger/context'

const isDev = process.env.NODE_ENV !== 'production'

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {}
    : {
        formatters: {
          level(label) {
            return { level: label }
          },
        },
      }),
})

function withContext(extra?: Record<string, unknown>): Record<string, unknown> {
  return { ...getCurrentContext(), ...extra }
}

type LogFn = (msg: string, ...args: unknown[]) => void

function wrapMethod(method: pino.LogFn): LogFn {
  return (message: string, ...args: unknown[]) => {
    const [first, ...rest] = args
    if (first instanceof Error) {
      method({ err: first, ...withContext(rest[0] as Record<string, unknown> | undefined) }, message)
    } else if (first && typeof first === 'object') {
      method(withContext(first as Record<string, unknown>), message)
    } else {
      method(withContext(), message)
    }
  }
}

export const logger = {
  level: baseLogger.level,
  trace: wrapMethod(baseLogger.trace.bind(baseLogger)),
  debug: wrapMethod(baseLogger.debug.bind(baseLogger)),
  info: wrapMethod(baseLogger.info.bind(baseLogger)),
  warn: wrapMethod(baseLogger.warn.bind(baseLogger)),
  error: wrapMethod(baseLogger.error.bind(baseLogger)),
  fatal: wrapMethod(baseLogger.fatal.bind(baseLogger)),
  child: (bindings: Record<string, unknown>) => pino({ ...baseLogger, ...bindings }),
}

export type Logger = typeof logger
