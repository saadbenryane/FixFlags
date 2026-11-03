#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { loadRuntimeEnvironment } from '../lib/runtime/environment.mjs'
import { runtimeEntry } from './runtime-artifacts.mjs'
import { createWorkerHealth } from '../lib/runtime/worker-health.mjs'
import { superviseWorkerBrowser } from '../lib/runtime/worker-browser.mjs'

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
  ...(mode === 'worker' ? { FIXFLAGS_SUPERVISED_BROWSER: 'true' } : {}),
  ...(mode === 'worker' && !process.env.AUDIT_WORKER_CONCURRENCY ? { AUDIT_WORKER_CONCURRENCY: '2' } : {}),
}

let healthServer
const workerHealth = createWorkerHealth()
if (mode === 'worker') {
  const port = parseInt(process.env.WORKER_HEALTH_PORT || process.env.PORT || '8080', 10)
  healthServer = createServer((_req, res) => {
    const snapshot = workerHealth.snapshot()
    res.writeHead(snapshot.ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(snapshot))
  })
  try {
    await new Promise((resolve, reject) => {
      healthServer.once('error', reject)
      healthServer.listen(port, '0.0.0.0', resolve)
    })
    console.log(`[health] Worker health server listening on port ${healthServer.address().port}`)
  } catch {
    console.error(`Worker health port ${port} is unavailable. No worker was started.`)
    process.exit(1)
  }
}

const child = spawn(process.execPath, [entry], {
  stdio: mode === 'worker' ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
  env: childEnv,
})
const browsers = mode === 'worker' ? superviseWorkerBrowser(child, async options => {
  const { chromium } = await import('playwright')
  return chromium.launchServer(options)
}) : null

if (healthServer) {
  child.on('message', message => workerHealth.receive(message))
  child.on('disconnect', () => workerHealth.stop())
  child.on('exit', () => healthServer.close())
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { workerHealth.stop(); child.kill(signal) })
}
child.on('error', (error) => {
  console.error(`Failed to start ${mode}:`, error)
  process.exit(1)
})
child.on('exit', async (code, signal) => {
  try { await browsers?.stop() }
  catch { console.error('Owned browser cleanup failed'); process.exit(1) }
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
