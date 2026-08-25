#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const productionUrl = process.env.PRODUCTION_URL?.trim()
if (!productionUrl) throw new Error('PRODUCTION_URL is required; deployed release verification cannot be skipped')
const target = new URL(productionUrl)
if (
  target.protocol !== 'https:' ||
  !['fixflags.com', 'www.fixflags.com'].includes(target.hostname) ||
  target.username ||
  target.password ||
  target.search ||
  target.hash ||
  target.pathname !== '/'
) {
  throw new Error('PRODUCTION_URL must be the clean canonical production origin')
}
const baseUrl = target.origin
const expectedCommit = process.env.RELEASE_EXPECTED_GIT_SHA?.trim()
if (!/^[a-f0-9]{40}$/.test(expectedCommit ?? '')) {
  throw new Error('RELEASE_EXPECTED_GIT_SHA must be the full candidate revision')
}

async function probe(path, label) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: process.env.RELEASE_SMOKE_BEARER
      ? { authorization: `Bearer ${process.env.RELEASE_SMOKE_BEARER}` }
      : undefined,
    signal: AbortSignal.timeout(60_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.ok !== true) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(body)}`)
  }
  console.log(`PASS ${label}`)
  return body
}

const health = await probe('/api/health', 'deployed revision')
if (typeof health?.commit !== 'string' || !/^[a-f0-9]{40}$/.test(health.commit)) {
  throw new Error('deployed revision failed: /api/health returned no full Git SHA')
}
if (health.commit !== expectedCommit) {
  throw new Error(
    `deployed revision failed: running ${health.commit} does not exactly match candidate ${expectedCommit}`,
  )
}
console.log(`PASS candidate revision ${health.commit}`)

await probe('/api/health/ready', 'launch readiness')
await probe('/api/health/browser', 'Chromium and R2')
await probe('/api/health/ai?validate=1', 'AI credentials')

const { runRouteBoundarySmoke } = await import('./route-boundary-smoke.mjs')
const routeCount = await runRouteBoundarySmoke(
  baseUrl,
  process.env.RELEASE_SMOKE_BEARER
    ? { authorization: `Bearer ${process.env.RELEASE_SMOKE_BEARER}` }
    : {},
)
console.log(`PASS route boundary smoke (${routeCount} routes)`)

if (process.env.RELEASE_SMOKE_EVIDENCE_FILE) {
  const evidencePath = path.resolve(process.env.RELEASE_SMOKE_EVIDENCE_FILE)
  await mkdir(path.dirname(evidencePath), { recursive: true, mode: 0o700 })
  await writeFile(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    targetOrigin: new URL(baseUrl).origin,
    expectedCommit,
    runningCommit: health.commit,
    routeCount,
    completedAt: new Date().toISOString(),
  }, null, 2)}\n`, { mode: 0o600 })
}
