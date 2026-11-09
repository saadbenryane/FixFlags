import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { prepareResearchDraft } from '@/lib/growth/research-draft'
import { readReportJson } from './read-report-json'

async function main() {
  const [manifestPath, method, start, end, ...extra] = process.argv.slice(2)
  if (!manifestPath || !method || extra.length) throw new Error('Invalid options')
  const window = { start: new Date(z.iso.datetime().parse(start)), end: new Date(z.iso.datetime().parse(end)) }
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Loopback database required')
  }
  const manifest = await readReportJson(manifestPath)
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
  try {
    const selection = method === '--recoveries' ? { recoveries: true as const } : { checkId: method }
    const report = await prepareResearchDraft({ manifest, ...selection, ...window }, db)
    console.log(JSON.stringify(report, null, 2))
    if (report.status !== 'reviewable-draft' && report.status !== 'reviewable-recovery-draft') process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main().catch(() => {
  console.error('Research draft unavailable. Supply an unreviewed private manifest, an eligible check ID or --recoveries, and UTC start and end timestamps with a loopback database.')
  process.exitCode = 1
})
