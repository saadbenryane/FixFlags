import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import Redis from 'ioredis'
import { loadRuntimeEnvironment, shutdownDeadlineMs } from '../lib/runtime/environment.mjs'
import { readLocalWorkerOwner, freshWorkerHeartbeats, workerConflict } from '../lib/runtime/local-worker.mjs'
import { readRuntimeState, requestRuntimeControl } from './local-runtime-control.mjs'

loadRuntimeEnvironment('development')
const command = process.argv[2]
try {
  if (!['status', 'stop'].includes(command)) throw new Error('Usage: node scripts/dev-control.mjs <status|stop>')
  const state = await readRuntimeState()
  if (command === 'stop') {
    if (!state) throw new Error('No managed runtime for this checkout. Unmanaged workers must be stopped in their owning terminal; no process was signalled.')
    await requestRuntimeControl(state, 'stop')
    console.log('Stopping this checkout’s runtime and draining active work...')
    const deadline = Date.now() + shutdownDeadlineMs() + 5000
    while (Date.now() < deadline) {
      const current = await readRuntimeState()
      if (!current) { console.log('Local runtime stopped.'); break }
      if (current.runtimeId !== state.runtimeId) throw new Error('Runtime ownership changed while stopping; no additional process was signalled.')
      await delay(200)
    }
    if (await readRuntimeState()) throw new Error('Runtime stop did not complete within its shutdown deadline.')
  } else {
    let managed = null
    if (state) {
      try { managed = await requestRuntimeControl(state, 'status'); console.log(`Runtime: ${managed.phase}, ${managed.origin}, supervisor PID ${state.pid}`) }
      catch { console.log('Runtime: recorded supervisor unavailable; its PID was not signalled. Inspect the owning terminal.') }
    } else console.log('Runtime: no managed session in this checkout')
    const redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, connectTimeout: 2000, commandTimeout: 3000, maxRetriesPerRequest: 0, retryStrategy: () => null })
    redis.on('error', () => {})
    try {
      await redis.connect()
      const owner = await readLocalWorkerOwner(redis)
      const records = await freshWorkerHeartbeats(redis)
      console.log(`Worker: ${records.length} fresh heartbeat(s)`)
      if (owner) console.log(workerConflict(owner))
      else if (records.length) console.log(workerConflict(null))
    } finally { redis.disconnect() }
    const child = spawn(process.execPath, ['scripts/doctor.mjs', ...(managed ? ['--live'] : [])], { stdio: 'inherit', env: process.env })
    process.exitCode = await new Promise(resolve => { child.once('error', () => resolve(1)); child.once('close', code => resolve(code ?? 1)) })
  }
} catch (error) {
  // Redis/transport errors may contain credentials; only known diagnostics are shown.
  console.error(command === 'stop' ? `Stop refused: ${error.code ? error.code : error.message}` : 'Status unavailable. Check prerequisites with npm run doctor.')
  process.exitCode = 1
}
