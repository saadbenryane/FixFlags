import { inspectGrowthReadiness } from '@/lib/growth/measurement-readiness'

async function main() {
  const args = process.argv.slice(2)
  const live = args.includes('--live')
  const dates = args.filter((arg) => arg !== '--live')
  if (dates.length !== 2 || args.length !== (live ? 3 : 2)) throw new Error('Invalid arguments')
  const result = await inspectGrowthReadiness({ startDate: dates[0], endDate: dates[1], live })
  console.log(JSON.stringify(result, null, 2))
  if (live && result.reportingStatus !== 'available') process.exitCode = 1
}
main().catch(() => {
  console.error('Growth readiness unavailable. Supply YYYY-MM-DD start and end dates, optionally --live. No credential, path or provider exception was printed.')
  process.exitCode = 1
})
