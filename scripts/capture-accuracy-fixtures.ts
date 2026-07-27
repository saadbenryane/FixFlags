/**
 * Capture live HTML snapshots for the accuracy regression corpus.
 *
 *   npm run accuracy:capture-fixtures
 */
import { writeFileSync } from 'node:fs'
import { safeFetchHtml } from '@/lib/audit/url'
import {
  curateAccuracyFixtureHtml,
  sanitizeFixtureHtml,
} from '@/lib/audit/fixture-sanitize'

const TARGETS = [
  { id: 'fixflags', url: 'https://fixflags.com', file: 'lib/audit/__tests__/fixtures/sites/fixflags-com.html', curated: false },
  { id: 'lovable', url: 'https://lovable.dev', file: 'lib/audit/__tests__/fixtures/sites/lovable-dev.html', curated: false },
  { id: 'bolt', url: 'https://bolt.new', file: 'lib/audit/__tests__/fixtures/sites/bolt-new.html', curated: false },
  { id: 'cineverse', url: 'https://cineverse.replit.app', file: 'lib/audit/__tests__/fixtures/sites/cineverse-replit-app.html', curated: false },
  { id: 'linear', url: 'https://linear.app', file: 'lib/audit/__tests__/fixtures/sites/linear-app.html', curated: true },
  { id: 'v0', url: 'https://v0.dev', file: 'lib/audit/__tests__/fixtures/sites/v0-dev.html', curated: true },
  { id: 'replit', url: 'https://replit.com', file: 'lib/audit/__tests__/fixtures/sites/replit-com.html', curated: true },
] as const

async function main() {
  const capturedAt = new Date().toISOString()
  const requested = new Set(process.argv.slice(2))
  const targets = requested.size > 0
    ? TARGETS.filter((target) => requested.has(target.id))
    : TARGETS
  if (targets.length === 0) {
    throw new Error(`Unknown fixture target. Choose: ${TARGETS.map((target) => target.id).join(', ')}`)
  }

  for (const target of targets) {
    const { html } = await safeFetchHtml(target.url)
    const source = target.curated ? curateAccuracyFixtureHtml(html) : html
    const sanitized = sanitizeFixtureHtml(source, { sourceUrl: target.url, capturedAt })
    writeFileSync(target.file, sanitized)
    console.log(`wrote ${target.file} (${sanitized.length} bytes) from ${target.url}`)
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
