#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

if (existsSync('.env.local')) config({ path: '.env.local', override: false })

const mode = process.argv[2] ?? 'web'
if (mode !== 'web' && mode !== 'worker') {
  console.error('Usage: node scripts/runtime-start.mjs <web|worker>')
  process.exit(1)
}

const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))
const migration = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
})
if (migration.status !== 0) process.exit(migration.status ?? 1)

const nextDistDir = process.env.NEXT_DIST_DIR || '.next'
const webEntry = existsSync('server.js') ? 'server.js' : `${nextDistDir}/standalone/server.js`
const entry = mode === 'web' ? webEntry : 'dist/worker/index.js'
if (!existsSync(entry)) {
  console.error(`Runtime entry is missing: ${entry}`)
  process.exit(1)
}

const childEnv = {
  ...process.env,
  FIXFLAGS_PROCESS_ROLE: mode,
  ...(mode === 'worker' && !process.env.AUDIT_WORKER_CONCURRENCY ? { AUDIT_WORKER_CONCURRENCY: '2' } : {}),
}

let healthServer
if (mode === 'worker') {
  const port = parseInt(process.env.WORKER_HEALTH_PORT || process.env.PORT || '8080', 10)
  healthServer = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
  })
  healthServer.listen(port, '0.0.0.0', () => {
    console.log(`[health] Worker health server listening on port ${port}`)
  })
}

const child = spawn(process.execPath, [entry], {
  stdio: 'inherit',
  env: childEnv,
})

if (healthServer) {
  child.on('exit', () => healthServer.close())
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('error', (error) => {
  console.error(`Failed to start ${mode}:`, error)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
