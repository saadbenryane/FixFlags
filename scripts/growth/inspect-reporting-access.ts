import { parseArgs } from 'node:util'
import { inspectFixFlagsReporting } from '@/lib/growth/reporting-access'

/** Returns aggregate read-only reports. Never prints credentials or user-level rows. */
async function main() {
  const { positionals, values: { guide, 'ai-referrals': aiReferrals, 'route-privacy': routePrivacy } } = parseArgs({
    allowPositionals: true,
    options: { guide: { type: 'string' }, 'ai-referrals': { type: 'boolean' }, 'route-privacy': { type: 'boolean' } },
  })
  if (positionals.length !== 2 || guide === '') throw new Error('Dates and optional reporting filters required')
  const [startDate, endDate] = positionals
  const result = await inspectFixFlagsReporting(startDate, endDate, guide, { aiReferrals, routePrivacy })
  console.log(JSON.stringify(result, null, 2))
  if (result.ga4.status !== 'report-read-succeeded' || result.searchConsole.status !== 'report-read-succeeded' ||
    (guide && (result.analyzeClicks?.status !== 'report-read-succeeded' ||
      result.landingSessions?.status !== 'report-read-succeeded')) ||
    (aiReferrals && result.aiReferralSessions?.status !== 'report-read-succeeded') ||
    result.routePrivacy?.checks.some(check => check.status !== 'report-read-succeeded')) process.exitCode = 1
}

main().catch(() => {
  // Provider exceptions can include signed requests, credentials, and private responses.
  console.error('Reporting inspection failed. Check the configured properties, credential access, dates and optional --guide, --ai-referrals or --route-privacy flags. No provider response or credential was printed.')
  process.exitCode = 1
})
