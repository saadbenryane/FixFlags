import * as nextEnv from '@next/env'

/** Match Next's file precedence without replacing inherited runtime values. */
export function loadRuntimeEnvironment(mode = process.env.NODE_ENV || 'development', cwd = process.cwd()) {
  process.env.NODE_ENV = mode
  const load = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig
  load(cwd, mode === 'development', { info() {}, error() {} })
  return process.env
}

export function developmentEnvironment(args = [], inherited = process.env) {
  if (args.length && (args.length !== 2 || args[0] !== '--port')) {
    throw new Error('Usage: npm run dev -- --port <1024-65535>')
  }
  const port = Number(args.length ? args[1] : inherited.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Use --port with a port between 1024 and 65535')
  }
  const origin = `http://localhost:${port}`
  return { ...inherited, NODE_ENV: 'development', PORT: String(port), BETTER_AUTH_URL: origin, NEXT_PUBLIC_APP_URL: origin, FIXFLAGS_ALLOW_DUPLICATE_WORKERS: '0' }
}

export function shutdownDeadlineMs(env = process.env) {
  const base = Number(env.AUDIT_DEADLINE_MS ?? 300_000)
  return (Number.isFinite(base) && base > 0 ? base : 300_000) + 360_000 + 30_000
}
