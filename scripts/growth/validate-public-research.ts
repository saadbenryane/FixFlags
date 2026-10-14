import { readFile } from 'node:fs/promises'
import { parsePublicIssueResearch } from '@/lib/graph/public-research'

/** Local validation only. This command never stores or publishes a dataset. */
async function main() {
  const path = process.argv[2]
  if (!path || process.argv.length !== 3) {
    throw new Error('Usage: npx tsx scripts/growth/validate-public-research.ts <release.json>')
  }
  const payload: unknown = JSON.parse(await readFile(path, 'utf8'))
  const dataset = parsePublicIssueResearch(payload)
  if (!dataset) throw new Error('Research release rejected. Check approval, schema, cohort sizes, check versions, and dates.')
  console.log(JSON.stringify({
    status: 'valid-local-artifact',
    published: false,
    permissionsVerified: false,
    sampleSites: dataset.sampleSiteCount,
    issues: dataset.issues.length,
    windowStart: dataset.windowStart,
    windowEnd: dataset.windowEnd,
    expiresAt: dataset.expiresAt,
  }, null, 2))
}

main().catch(() => {
  // Do not echo a malformed input, path, private approval reference, or raw JSON.
  console.error('Research release validation failed. Check approval, schema, cohort sizes, check versions, dates, and JSON input. Usage: npx tsx scripts/growth/validate-public-research.ts <release.json>')
  process.exitCode = 1
})
