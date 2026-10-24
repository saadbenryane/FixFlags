import { Client } from 'pg'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

// Database-scoped session lock, separate from Prisma's internal migration lock.
// Waiters poll outside a transaction so they cannot hold the old snapshots that
// CREATE INDEX CONCURRENTLY must wait for.
export const MIGRATION_LOCK = [0x46697846, 1]

function ownedMigration({ args, cliPath, cwd, env, signal, timeoutMs, stdio }) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted()
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd, env, stdio, detached: process.platform !== 'win32',
    })
    if (stdio === 'pipe') { child.stdout?.resume(); child.stderr?.resume() }
    let interrupted, escalation
    function terminate(name) {
      if (!child.pid) return
      try {
        if (process.platform === 'win32') child.kill(name)
        else process.kill(-child.pid, name)
      } catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    function abort() {
      if (interrupted) return
      interrupted = signal.reason ?? new Error('Migration startup interrupted')
      terminate(interrupted.code === 'MIGRATION_COORDINATION_LOST' ? 'SIGKILL' : 'SIGTERM')
      escalation = setTimeout(() => terminate('SIGKILL'), 5000)
      escalation.unref()
    }
    signal.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(() => {
      interrupted = new Error('Migration execution deadline exceeded')
      terminate('SIGKILL')
    }, timeoutMs)
    timeout.unref()
    child.once('error', error => { interrupted = error })
    child.once('close', code => {
      clearTimeout(timeout); clearTimeout(escalation)
      signal.removeEventListener('abort', abort)
      // A CLI wrapper must not leave an engine in its owned process group.
      terminate('SIGKILL')
      if (interrupted) reject(interrupted)
      else resolve(code ?? 1)
    })
    if (signal.aborted) abort()
  })
}

/** Admit one migrator per database before entering Prisma's blocking lock. */
export async function deployMigrations({
  env = process.env, cwd = process.cwd(), args = ['migrate', 'deploy'],
  cliPath = fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url)),
  createClient = configuration => new Client(configuration),
  waitMs = 120_000, pollMs = 200, executionMs = 600_000, stdio = 'inherit',
  log = console.log,
} = {}) {
  let database
  try { database = new URL(env.DATABASE_URL) } catch { throw new Error('Migration startup requires a valid PostgreSQL DATABASE_URL') }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) throw new Error('Migration startup requires PostgreSQL')
  const client = createClient({ connectionString: database.href, connectionTimeoutMillis: 10_000,
    query_timeout: 5000, keepAlive: true, keepAliveInitialDelayMillis: 5000,
    application_name: 'fixflags-migration-coordinator' })
  const controller = new AbortController()
  let closing = false, heartbeat, timer
  const lost = () => {
    if (closing || controller.signal.aborted) return
    const error = new Error('Database migration coordination was lost; startup stopped')
    error.code = 'MIGRATION_COORDINATION_LOST'
    controller.abort(error)
  }
  const interrupted = () => controller.abort(new Error('Migration startup interrupted'))
  client.on('error', lost); client.on('end', lost)
  process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted)
  try {
    await client.connect()
    const deadline = performance.now() + waitMs
    let announced = false
    while (true) {
      controller.signal.throwIfAborted()
      const result = await client.query('SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired', MIGRATION_LOCK)
      if (result.rows[0]?.acquired === true) break
      if (performance.now() >= deadline) throw new Error('Another database migration did not finish before the startup deadline')
      if (!announced) { log('Waiting for the active database migration to finish.'); announced = true }
      await delay(pollMs, undefined, { signal: controller.signal })
    }
    controller.signal.throwIfAborted()
    timer = setInterval(() => {
      if (!heartbeat) heartbeat = client.query('SELECT 1').catch(lost).finally(() => { heartbeat = null })
    }, 5000)
    timer.unref()
    // PostgreSQL otherwise may keep executing after the CLI socket disappears.
    // Limit this setting to migration connections, retaining existing options.
    const migrationUrl = new URL(database.href)
    migrationUrl.searchParams.set('options', [migrationUrl.searchParams.get('options'), '-c client_connection_check_interval=1000'].filter(Boolean).join(' '))
    const code = await ownedMigration({ args, cliPath, cwd, env: { ...env, DATABASE_URL: migrationUrl.href },
      signal: controller.signal, timeoutMs: executionMs, stdio })
    controller.signal.throwIfAborted()
    return code
  } finally {
    closing = true
    clearInterval(timer)
    await heartbeat
    // Closing the dedicated session releases its lock after the owned engine exits.
    await client.end()
    client.removeListener('error', lost); client.removeListener('end', lost)
    process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted)
  }
}
