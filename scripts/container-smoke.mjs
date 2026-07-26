#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import process from 'node:process'

const envFile = process.env.RELEASE_CONTAINER_ENV_FILE
if (!envFile || !existsSync(envFile)) {
  throw new Error(
    'RELEASE_CONTAINER_ENV_FILE must point to the designated production-like release environment'
  )
}

const suffix = String(process.pid)
const network = `fixflags-release-net-${suffix}`
const postgres = `fixflags-release-db-${suffix}`
const redis = `fixflags-release-redis-${suffix}`
const web = `fixflags-release-web-${suffix}`
const worker = `fixflags-release-worker-${suffix}`
const image = 'fixflags:release-check'
const databaseUrl = 'postgresql://fixflags:fixflags@postgres:5432/fixflags_release'
const redisUrl = 'redis://redis:6379'

function docker(args, allowFailure = false) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || `docker ${args[0]} failed`).trim()
    )
  }
  return result.stdout.trim()
}

async function waitFor(label, timeoutMs, check) {
  const deadline = Date.now() + timeoutMs
  let lastError = `${label} did not answer`
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(`${label} timed out: ${lastError}`)
}

function applicationArgs(name, role) {
  return [
    'run',
    '--detach',
    '--name',
    name,
    '--network',
    network,
    '--env-file',
    envFile,
    '--env',
    `DATABASE_URL=${databaseUrl}`,
    '--env',
    `REDIS_URL=${redisUrl}`,
    '--env',
    `FIXFLAGS_PROCESS_ROLE=${role}`,
    '--env',
    'AUDIT_WORKER_CONCURRENCY=1',
    ...(role === 'web' ? ['--publish', '127.0.0.1::8080'] : []),
    ...(role === 'worker'
      ? ['--entrypoint', 'node', image, 'scripts/runtime-start.mjs', 'worker']
      : [image]),
  ]
}

try {
  docker(['network', 'create', network])
  docker([
    'run',
    '--detach',
    '--name',
    postgres,
    '--network',
    network,
    '--network-alias',
    'postgres',
    '--env',
    'POSTGRES_USER=fixflags',
    '--env',
    'POSTGRES_PASSWORD=fixflags',
    '--env',
    'POSTGRES_DB=fixflags_release',
    'postgres:16-alpine',
  ])
  docker([
    'run',
    '--detach',
    '--name',
    redis,
    '--network',
    network,
    '--network-alias',
    'redis',
    'redis:7-alpine',
  ])

  await waitFor('Postgres', 60_000, async () => {
    return (
      docker(
        ['exec', postgres, 'pg_isready', '-U', 'fixflags', '-d', 'fixflags_release'],
        true
      ).includes('accepting connections')
    )
  })
  await waitFor('Redis', 30_000, async () => {
    return docker(['exec', redis, 'redis-cli', 'ping'], true) === 'PONG'
  })

  docker(applicationArgs(worker, 'worker'))
  docker(applicationArgs(web, 'web'))

  const binding = docker(['port', web, '8080/tcp']).split('\n')[0]
  const port = binding.match(/:(\d+)$/)?.[1]
  if (!port) throw new Error(`Could not resolve web container port from ${binding}`)
  const baseUrl = `http://127.0.0.1:${port}`

  await waitFor('web and worker readiness', 180_000, async () => {
    const response = await fetch(`${baseUrl}/api/health/ready`, {
      signal: AbortSignal.timeout(5_000),
    })
    const body = await response.json().catch(() => null)
    return response.ok && body?.ok === true && body?.subsystems?.worker?.ok === true
  })

  const workerHealth = await fetch(`${baseUrl}/api/health/worker`, {
    signal: AbortSignal.timeout(10_000),
  }).then((response) => response.json())
  if (
    workerHealth?.worker?.workerCount !== 1 ||
    workerHealth?.worker?.browserOk !== true
  ) {
    throw new Error(
      `Dedicated worker topology was not observed: ${JSON.stringify(workerHealth)}`
    )
  }

  const targetUrl =
    process.env.RELEASE_CONTAINER_AUDIT_URL ?? 'https://example.com/'
  const createResponse = await fetch(`${baseUrl}/api/checks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, mode: 'single', source: 'release_smoke' }),
    signal: AbortSignal.timeout(30_000),
  })
  const created = await createResponse.json().catch(() => null)
  if (!createResponse.ok || !created?.reportId) {
    throw new Error(
      `Container check creation failed (${createResponse.status}): ${JSON.stringify(created)}`
    )
  }

  await waitFor('container audit completion', 240_000, async () => {
    const response = await fetch(
      `${baseUrl}/api/reports/${encodeURIComponent(created.reportId)}/status`,
      { signal: AbortSignal.timeout(10_000) }
    )
    const body = await response.json().catch(() => null)
    if (body?.status === 'FAILED') {
      throw new Error(
        `Container audit failed: ${body.failureCode ?? body.errorMsg ?? 'unknown failure'}`
      )
    }
    return response.ok && body?.status === 'COMPLETED'
  })

  console.log(
    `Container topology passed: Postgres + Redis + web + dedicated worker; report ${created.reportId} completed.`
  )
} catch (error) {
  const webLogs = docker(['logs', '--tail', '100', web], true)
  const workerLogs = docker(['logs', '--tail', '100', worker], true)
  const detail = error instanceof Error ? error.message : String(error)
  throw new Error(
    `${detail}\n--- web logs ---\n${webLogs}\n--- worker logs ---\n${workerLogs}`
  )
} finally {
  for (const name of [web, worker, redis, postgres]) {
    docker(['rm', '--force', name], true)
  }
  docker(['network', 'rm', network], true)
}
