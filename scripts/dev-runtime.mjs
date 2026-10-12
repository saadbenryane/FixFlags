import net from 'node:net'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import Redis from 'ioredis'
import { loadRuntimeEnvironment, developmentEnvironment, shutdownDeadlineMs } from '../lib/runtime/environment.mjs'
import { freshWorkerHeartbeats, readLocalWorkerOwner, workerConflict } from '../lib/runtime/local-worker.mjs'
import { localReadiness } from '../lib/runtime/readiness.mjs'
import { createRuntimeControl } from './local-runtime-control.mjs'
import { createSupervisor } from './runtime-supervisor.mjs'

loadRuntimeEnvironment('development')
const runtimeId = randomUUID(), workerId = randomUUID()
const env = { ...developmentEnvironment(process.argv.slice(2)), FIXFLAGS_LOCAL_RUNTIME_ID: runtimeId, FIXFLAGS_WORKER_ID: workerId }
const origin = env.NEXT_PUBLIC_APP_URL
const abort = new AbortController()
let control, phase = 'preflight', stopPromise, exitCode = 0
let startupDone
const startupSettled = new Promise(resolve => { startupDone = resolve })
const redis = new Redis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, commandTimeout: 3000, maxRetriesPerRequest: 0, retryStrategy: () => null })
redis.on('error', () => {})
const supervisor = createSupervisor({ env, shutdownMs: shutdownDeadlineMs(env), onFailure: code => { void stop(code) } })

function stop(code = 0) {
  exitCode = Math.max(exitCode, code)
  if (stopPromise) return stopPromise
  abort.abort()
  phase = 'stopping'
  stopPromise = (async () => {
    const clean = await supervisor.shutdown()
    await startupSettled
    redis.disconnect()
    await control?.close()
    process.exitCode = clean ? exitCode : 1
  })()
  return stopPromise
}
process.on('SIGINT', () => { void stop() })
process.on('SIGTERM', () => { void stop() })

async function checkPort() {
  const server = net.createServer()
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(env.PORT), resolve) })
  } catch { throw new Error(`Port ${env.PORT} is occupied. Choose --port <number>. No process was stopped.`) }
  finally { if (server.listening) await new Promise(resolve => server.close(resolve)) }
}

async function run() {
  try {
    control = await createRuntimeControl({ runtimeId, status: () => ({ origin, workerId, phase, stopping: abort.signal.aborted }), stop })
    abort.signal.throwIfAborted()
    await checkPort()
    abort.signal.throwIfAborted()
    const doctor = supervisor.launch(['scripts/doctor.mjs'], { role: 'doctor', transient: true })
    const result = await doctor.done
    abort.signal.throwIfAborted()
    if (result.code !== 0) throw new Error('Fix the failed prerequisites before starting.')
    await redis.connect()
    abort.signal.throwIfAborted()
    const owner = await readLocalWorkerOwner(redis)
    if (owner || (await freshWorkerHeartbeats(redis)).length) throw new Error(workerConflict(owner))
    abort.signal.throwIfAborted()
    phase = 'starting'
    supervisor.launch(['node_modules/next/dist/bin/next', 'dev', '--turbopack', '-p', env.PORT], { role: 'web', overrides: { FIXFLAGS_PROCESS_ROLE: 'web' } })
    supervisor.launch(['--import', 'tsx', 'worker/index.ts'], { role: 'worker', overrides: { FIXFLAGS_PROCESS_ROLE: 'worker', AUDIT_WORKER_CONCURRENCY: '1' } })
    const deadline = Date.now() + 120_000
    let observation = { ready: false, detail: 'web unavailable' }
    while (!abort.signal.aborted && Date.now() < deadline) {
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(3000)])
      const database = await fetch(`${origin}/api/health`, { signal }).catch(() => null)
      const response = await fetch(`${origin}/api/health/worker`, { signal }).catch(() => null)
      const health = response?.ok ? await response.json().catch(() => null) : null
      observation = database?.ok ? localReadiness(health, workerId) : { ready: false, detail: 'web/database health unavailable' }
      abort.signal.throwIfAborted()
      if (observation.ready) {
        phase = 'ready'
        console.log(`FixFlags web and browser worker ready: ${origin}`)
        console.log('Stop with Ctrl+C or npm run dev:stop. Inspect with npm run dev:status.')
        return
      }
      await delay(1000, undefined, { signal: abort.signal })
    }
    throw new Error(`Startup readiness timed out: ${observation.detail}. See the child logs above.`)
  } catch (error) {
    if (!abort.signal.aborted) { console.error(error.message); void stop(1) }
  } finally { startupDone() }
}
await run()
