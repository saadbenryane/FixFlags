const PREFIX = '[FixFlags]'

export const logger = {
  info: (message: string, data?: Record<string, unknown>) => {
    const line = data ? `${message} ${JSON.stringify(data)}` : message
    console.log(`${PREFIX} ${line}`)
  },
  error: (message: string, error?: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error ?? 'unknown'))
    console.error(`${PREFIX} [ERROR] ${message}`, err.stack ?? err.message)
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    const line = data ? `${message} ${JSON.stringify(data)}` : message
    console.warn(`${PREFIX} [WARN] ${line}`)
  },
}
