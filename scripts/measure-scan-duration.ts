/**
 * One-off: print median and p90 scan durations from completed audits.
 * Usage: npx tsx scripts/measure-scan-duration.ts
 * Do not put timing claims on the homepage until these numbers are known.
 */
import { prisma } from '../lib/db'

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}

async function main() {
  const rows = await prisma.audit.findMany({
    where: {
      status: 'COMPLETED',
      startedAt: { not: null },
      completedAt: { not: null },
    },
    select: { startedAt: true, completedAt: true },
    take: 5000,
    orderBy: { completedAt: 'desc' },
  })

  const durations = rows
    .map((r) => {
      if (r.startedAt && r.completedAt) {
        return r.completedAt.getTime() - r.startedAt.getTime()
      }
      return null
    })
    .filter((n): n is number => n != null && n > 0)
    .sort((a, b) => a - b)

  const median = percentile(durations, 50)
  const p90 = percentile(durations, 90)

  console.log(`Completed audits sampled: ${durations.length}`)
  console.log(
    `Median: ${median != null ? `${(median / 1000).toFixed(1)}s` : 'n/a'} (${median ?? 'n/a'} ms)`
  )
  console.log(
    `P90: ${p90 != null ? `${(p90 / 1000).toFixed(1)}s` : 'n/a'} (${p90 ?? 'n/a'} ms)`
  )
  console.log('Do not claim homepage timing until these are reviewed.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
