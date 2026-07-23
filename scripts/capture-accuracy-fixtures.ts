/**
 * Capture live HTML snapshots for the accuracy regression corpus.
 *
 *   npm run accuracy:capture-fixtures
 */
import { writeFileSync } from 'node:fs'
import { safeFetchHtml } from '@/lib/audit/url'
import { sanitizeFixtureHtml } from '@/lib/audit/fixture-sanitize'

const TARGETS = [
  { url: 'https://lovable.dev', file: 'lib/audit/__tests__/fixtures/sites/lovable-dev.html' },
  { url: 'https://bolt.new', file: 'lib/audit/__tests__/fixtures/sites/bolt-new.html' },
] as const

async function main() {
  const capturedAt = new Date().toISOString()

  for (const target of TARGETS) {
    const { html } = await safeFetchHtml(target.url)
    const sanitized = sanitizeFixtureHtml(html, { sourceUrl: target.url, capturedAt })
    writeFileSync(target.file, sanitized)
    console.log(`wrote ${target.file} (${sanitized.length} bytes) from ${target.url}`)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
