import { parseArgs } from 'node:util'
import { destinationStudyReadout, destinationStudySearchWindows } from '@/lib/growth/destination-study-readout'
import { readReportJson } from './read-report-json'

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { 'released-on': { type: 'string' }, 'publication-check': { type: 'string' }, 'window-end-check': { type: 'string' },
      'baseline-report': { type: 'string' }, 'commercial-report': { type: 'string' }, 'search-windows': { type: 'boolean' } },
  })
  if (values['search-windows']) {
    if (positionals.length || !values['released-on'] || Object.keys(values).length !== 2) throw new Error('Invalid search window options')
    console.log(JSON.stringify(destinationStudySearchWindows(values['released-on']), null, 2))
    return
  }
  if (![2, 3].includes(positionals.length) || values['baseline-report'] && !values['released-on']) throw new Error('Invalid options')
  const [reportingPath, operationalPath, sitesPath] = positionals
  const [reporting, operational, sites, publication, windowEnd, baselineReporting, commercial] = await Promise.all([
    readReportJson(reportingPath), readReportJson(operationalPath), sitesPath ? readReportJson(sitesPath) : undefined,
    values['publication-check'] ? readReportJson(values['publication-check']) : undefined,
    values['window-end-check'] ? readReportJson(values['window-end-check']) : undefined,
    values['baseline-report'] ? readReportJson(values['baseline-report']) : undefined,
    values['commercial-report'] ? readReportJson(values['commercial-report']) : undefined,
  ])
  const evidence = sitesPath ? { acquisition: operational, sites } : { operational }
  console.log(JSON.stringify(destinationStudyReadout({ reporting, ...evidence, releasedOn: values['released-on'], publication, windowEnd,
    baselineReporting, commercial }), null, 2))
}

main().catch(() => {
  console.error('Use --search-windows --released-on YYYY-MM-DD to print the dates, or pass matching 28-day aggregate reports. Release evaluation also needs --released-on YYYY-MM-DD, --publication-check receipt.json and --window-end-check receipt.json.')
  process.exitCode = 1
})
