#!/usr/bin/env node

const baseUrl = process.env.RELEASE_SMOKE_URL?.replace(/\/$/, '')
if (!baseUrl) throw new Error('RELEASE_SMOKE_URL is required; deployed release verification cannot be skipped')

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
}

await probe('/api/health/ready', 'launch readiness')
await probe('/api/health/browser', 'Chromium and R2')
await probe('/api/health/ai?validate=1', 'AI credentials')
