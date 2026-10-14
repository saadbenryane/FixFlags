import { inspectFixFlagsReporting } from '@/lib/growth/reporting-access'

/** Returns aggregate read-only reports. Never prints credentials or user-level rows. */
async function main() {
  const [startDate, endDate] = process.argv.slice(2)
  if (!startDate || !endDate || process.argv.length !== 4) throw new Error('Dates required')
  const result = await inspectFixFlagsReporting(startDate, endDate)
  console.log(JSON.stringify(result, null, 2))
  if (result.ga4.status !== 'report-read-succeeded' || result.searchConsole.status !== 'report-read-succeeded') process.exitCode = 1
}

main().catch(() => {
  // Provider exceptions can include signed requests, credentials, and private responses.
  console.error('Reporting inspection failed. Check target properties, credential access, and YYYY-MM-DD dates. No provider response or credential was printed.')
  process.exitCode = 1
})
