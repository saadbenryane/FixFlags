#!/usr/bin/env node

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validateRunningRevision(health, expectedGitSha) {
  if (!health || health.ok !== true) throw new Error('Release environment health is not ready')
  if (typeof health.commit !== 'string' || !/^[a-f0-9]{40}$/.test(health.commit)) {
    throw new Error('Release environment health must report a full Git SHA')
  }
  if (health.commit !== expectedGitSha) {
    throw new Error(`Release environment runs ${health.commit}, expected ${expectedGitSha}`)
  }
  return health.commit
}

export async function attestReleaseEnvironment(env = process.env, fetchImpl = fetch) {
  const rawTarget = env.RELEASE_ENV_URL?.trim()
  if (!rawTarget) throw new Error('RELEASE_ENV_URL is required')
  const target = new URL(rawTarget)
  if (
    target.protocol !== 'https:' ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== '/'
  ) {
    throw new Error('RELEASE_ENV_URL must be a clean HTTPS origin')
  }
  const targetOrigin = target.origin
  if (['fixflags.com', 'www.fixflags.com'].includes(target.hostname)) {
    throw new Error('Release environment attestation cannot target production')
  }
  const expectedGitSha = env.RELEASE_EXPECTED_GIT_SHA?.trim()
  if (!/^[a-f0-9]{40}$/.test(expectedGitSha ?? '')) {
    throw new Error('RELEASE_EXPECTED_GIT_SHA must be a full Git SHA')
  }
  const response = await fetchImpl(`${targetOrigin}/api/health`, {
    signal: AbortSignal.timeout(60_000),
  })
  const health = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`Release environment health failed (${response.status})`)
  const runningCommit = validateRunningRevision(health, expectedGitSha)
  return {
    schemaVersion: 1,
    targetOrigin,
    expectedGitSha,
    runningCommit,
    attestedAt: new Date().toISOString(),
  }
}

async function main() {
  const target = process.env.RELEASE_REVISION_EVIDENCE_FILE
  if (!target) throw new Error('RELEASE_REVISION_EVIDENCE_FILE is required')
  const evidence = await attestReleaseEnvironment()
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log(`Release environment revision PASS for ${evidence.runningCommit.slice(0, 8)}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
