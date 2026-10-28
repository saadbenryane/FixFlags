#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { loadRuntimeEnvironment } from '../lib/runtime/environment.mjs'
import { runtimeEntry } from './runtime-artifacts.mjs'

loadRuntimeEnvironment(process.env.NODE_ENV || 'production')

const mode = process.argv[2] ?? 'web'
let entry
try { entry = runtimeEntry(mode) }
catch (error) { console.error(error.message); process.exit(1) }

const { deployMigrations } = await import('../lib/runtime/migration-coordination.mjs')
try {
  const code = await deployMigrations()
  if (code !== 0) process.exit(code)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const childEnv = {
  ...process.env,
  FIXFLAGS_PROCESS_ROLE: mode,
  ...(mode === 'worker' && !process.env.AUDIT_WORKER_CONCURRENCY ? { AUDIT_WORKER_CONCURRENCY: '2' } : {}),
}

let healthServer
let workerState = 'starting'
let lastWorkerMessage = 0
if (mode === 'worker') {
  const port = parseInt(process.env.WORKER_HEALTH_PORT || process.env.PORT || '8080', 10)
  healthServer = createServer((_req, res) => {
    const state = workerState === 'ready' && Date.now() - lastWorkerMessage > 45_000 ? 'unresponsive' : workerState
    const ready = state === 'ready'
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ status: ready ? 'ok' : 'unavailable', state }))
  })
  try {
    await new Promise((resolve, reject) => {
      healthServer.once('error', reject)
      healthServer.listen(port, '0.0.0.0', resolve)
    })
    console.log(`[health] Worker health server listening on port ${port}`)
  } catch {
    console.error(`Worker health port ${port} is unavailable. No worker was started.`)
    process.exit(1)
  }
}

const child = spawn(process.execPath, [entry], {
  stdio: mode === 'worker' ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
  env: childEnv,
})

if (healthServer) {
  child.on('message', message => {
    if (message?.type !== 'fixflags-worker-state' || !['ready', 'stopping'].includes(message.state)) return
    if (workerState === 'stopping') return
    workerState = message.state
    lastWorkerMessage = Date.now()
  })
  child.on('exit', () => healthServer.close())
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { workerState = 'stopping'; child.kill(signal) })
}
child.on('error', (error) => {
  console.error(`Failed to start ${mode}:`, error)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
