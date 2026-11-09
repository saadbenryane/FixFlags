import { parsePublicIssueResearch } from '@/lib/graph/public-research'
import { readReportJson } from './read-report-json'

const USAGE = 'node --import tsx scripts/growth/validate-public-research.ts <release.json> [--manifest <private-manifest.json>]'

/** Local validation only. This command never stores or publishes a dataset. */
async function main() {
  const [path, flag, manifestPath, ...extra] = process.argv.slice(2)
  if (!path || extra.length || (flag !== undefined && (flag !== '--manifest' || !manifestPath))) {
    throw new Error('Invalid research validation options')
  }
  const payload = await readReportJson(path)
  if (manifestPath) {
    const url = new URL(process.env.DATABASE_URL ?? '')
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Loopback database required')
    }
    const manifest = await readReportJson(manifestPath)
    const { PrismaClient } = await import('@prisma/client')
    const { preflightResearchRelease } = await import('@/lib/growth/research-release-preflight')
    const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    try {
      const report = await preflightResearchRelease({ release: payload, manifest }, db)
      console.log(JSON.stringify(report, null, 2))
      if (report.status !== 'source-and-version-checks-passed') process.exitCode = 1
    } finally {
      await db.$disconnect()
    }
    return
  }
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
  console.error(`Research release validation unavailable. Check local JSON files and the loopback database configuration for manifest preflight. Usage: ${USAGE}`)
  process.exitCode = 1
})
