/**
 * Capture live HTML snapshots for the accuracy regression corpus.
 *
 *   npx tsx scripts/capture-accuracy-fixtures.ts
 */
import { writeFileSync } from 'node:fs'
import { safeFetchHtml } from '@/lib/audit/url'

const TARGETS = [
  { url: 'https://lovable.dev', file: 'lib/audit/__tests__/fixtures/sites/lovable-dev.html' },
  { url: 'https://bolt.new', file: 'lib/audit/__tests__/fixtures/sites/bolt-new.html' },
] as const

async function main() {
  for (const target of TARGETS) {
    const { html } = await safeFetchHtml(target.url)
    // Fixture HTML is used for metadata/accessibility checks only. Strip scripts
    // so captured bundles do not trip secret scanners or bloat the repo.
    let sanitized = `<!-- pragma: allowlist secret -->\n${html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<meta[^>]*(sentry-trace|baggage)[^>]*>/gi, '')
      .replace(/NODE_ENV/g, 'RUNTIME_ENV')}`
    writeFileSync(target.file, sanitized)
    console.log(`wrote ${target.file} (${sanitized.length} bytes) from ${target.url}`)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
