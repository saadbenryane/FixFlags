import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { inspectFixFlagsLandingJourneys } from '@/lib/growth/ga-pull'

async function main() {
  const [startDate, endDate] = z.tuple([z.iso.date(), z.iso.date()]).parse(process.argv.slice(2))
  const now = new Date()
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1
  if (days < 1 || days > 90 || endDate >= now.toISOString().slice(0, 10)) throw new Error('Use a closed window of 1 to 90 days')
  const db = new PrismaClient({ log: [] })
  try {
    const report = await inspectFixFlagsLandingJourneys({ startDate, endDate }, db)
    if (!report) throw new Error('Landing source unavailable')
    console.log(JSON.stringify({ ...report, databaseWritten: false }, null, 2))
    if (report.status === 'unavailable' || report.status === 'incomparable') process.exitCode = 1
  } finally { await db.$disconnect() }
}

main().catch(() => {
  console.error('Landing value inspection unavailable. Use a closed date window and the authorized FixFlags reporting and database configuration.')
  process.exitCode = 1
})
