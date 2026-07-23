#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
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

const webEntry = existsSync('server.js') ? 'server.js' : '.next/standalone/server.js'
const entry = mode === 'web' ? webEntry : 'dist/worker/index.js'
if (!existsSync(entry)) {
  console.error(`Runtime entry is missing: ${entry}`)
  process.exit(1)
}

const child = spawn(process.execPath, [entry], { stdio: 'inherit', env: process.env })
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
