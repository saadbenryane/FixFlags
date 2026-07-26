#!/usr/bin/env node

const packageName = 'fixflags'
const registryUrl = `https://registry.npmjs.org/${packageName}`
const downloadsUrl = 'https://api.npmjs.org/downloads/point'

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  return response.json()
}

async function fetchDownloads(period) {
  const url = `${downloadsUrl}/${period}/${packageName}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`)
  }
  const data = await response.json()
  return data.downloads
}

const [metadata, weekly, monthly] = await Promise.all([
  fetchJson(registryUrl),
  fetchDownloads('last-week'),
  fetchDownloads('last-month'),
])

const tags = metadata['dist-tags'] ?? {}
const currentVersion = tags.beta ?? tags.latest ?? null
const result = {
  package: packageName,
  visibility: 'public',
  repository: metadata.repository?.url ?? null,
  versions: Object.keys(metadata.versions ?? {}).length,
  tags,
  currentPublishedAt: currentVersion
    ? metadata.time?.[currentVersion] ?? null
    : null,
  downloads: {
    lastWeek: weekly,
    lastMonth: monthly,
  },
  packageUrl: `https://www.npmjs.com/package/${packageName}`,
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`FixFlags npm package: ${result.packageUrl}`)
  console.log(`Versions: ${result.versions}`)
  console.log(`Tags: ${JSON.stringify(result.tags)}`)
  console.log(`Current published: ${result.currentPublishedAt ?? 'unknown'}`)
  console.log(
    `Downloads: ${result.downloads.lastWeek ?? 'not available'} last week, ${result.downloads.lastMonth ?? 'not available'} last month`
  )
  console.log(`Source: ${result.repository ?? 'not declared'}`)
}
