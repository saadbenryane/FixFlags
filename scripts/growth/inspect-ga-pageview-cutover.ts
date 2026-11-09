import { inspectGaPageviewCutover } from '@/lib/growth/ga-pageview-cutover'

async function main() {
  if (process.argv.length !== 2) throw new Error('Invalid arguments')
  const report = await inspectGaPageviewCutover()
  console.log(JSON.stringify(report, null, 2))
  if (report.status !== 'provider-prerequisite-met') process.exitCode = 1
}

main().catch(() => {
  console.error('GA4 pageview cutover inspection unavailable. Supply the candidate and reporting settings in the environment.')
  process.exitCode = 1
})
