#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const envFile = process.env.RELEASE_CONTAINER_ENV_FILE
if (!envFile || !existsSync(envFile)) {
  throw new Error('RELEASE_CONTAINER_ENV_FILE must point to the designated production-like release environment')
}

const name = `fixflags-release-${process.pid}`
function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (!allowFailure && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `docker ${args[0]} failed`).trim())
  }
  return result.stdout.trim()
}

try {
  docker([
    'run', '--detach', '--name', name,
    '--env-file', envFile,
    '--publish', '127.0.0.1::8080',
    'fixflags:release-check',
  ])
  const binding = docker(['port', name, '8080/tcp']).split('\n')[0]
  const port = binding.match(/:(\d+)$/)?.[1]
  if (!port) throw new Error(`Could not resolve container port from ${binding}`)

  const deadline = Date.now() + 120_000
  let lastError = 'container did not answer'
  let ready = false
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health/ready`, {
        signal: AbortSignal.timeout(5_000),
      })
      const body = await response.json()
      if (response.ok && body?.ok === true) {
        ready = true
        break
      }
      lastError = `${response.status}: ${JSON.stringify(body)}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  if (!ready) {
    const logs = docker(['logs', '--tail', '80', name], true)
    throw new Error(`Container readiness timed out: ${lastError}\n${logs}`)
  }
  console.log('Container boot and launch readiness passed.')
} finally {
  docker(['rm', '--force', name], true)
}
