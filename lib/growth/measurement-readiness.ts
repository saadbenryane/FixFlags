import { inspectFixFlagsReporting } from './reporting-access'

export function validateMeasurementWindow(startDate: string, endDate: string) {
  for (const date of [startDate, endDate]) {
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Invalid reporting date')
  }
  if (startDate > endDate) throw new Error('Invalid reporting window')
}

/** Configuration presence is not access proof. The default never contacts providers. */
export async function inspectGrowthReadiness(options: { startDate: string; endDate: string; live?: boolean }, env: NodeJS.ProcessEnv = process.env, inspect = inspectFixFlagsReporting) {
  validateMeasurementWindow(options.startDate, options.endDate)
  const prerequisites = {
    ga4Property: env.GA4_PROPERTY_ID?.replace(/^properties\//, '') === '541892062' ? 'configured' : 'unavailable',
    searchConsoleProperty: env.GSC_PROPERTY === 'sc-domain:fixflags.com' ? 'configured' : 'unavailable',
    reportingCredential: env.GSC_SERVICE_ACCOUNT_KEY?.trim() ? 'present-unverified' : 'unavailable',
    browserMeasurement: env.NEXT_PUBLIC_GA_ID === 'G-5GEP9X4ZWG' ? 'configured-build-unverified' : 'unavailable',
    operationalDatabase: env.DATABASE_URL?.trim() ? 'present-unverified' : 'unavailable',
  }
  let reporting: Awaited<ReturnType<typeof inspectFixFlagsReporting>> | null = null
  let reportingStatus = options.live ? 'prerequisites-unavailable' : 'not-requested'
  if (options.live && prerequisites.ga4Property === 'configured' && prerequisites.searchConsoleProperty === 'configured' && prerequisites.reportingCredential === 'present-unverified') {
    try {
      reporting = await inspect(options.startDate, options.endDate)
      reportingStatus = reporting.ga4.status === 'report-read-succeeded' && reporting.searchConsole.status === 'report-read-succeeded' ? 'available' : 'partial-or-unavailable'
    } catch { reportingStatus = 'unavailable' }
  }
  return {
    source: 'FixFlags configured environment; lib/growth/reporting-access.ts',
    observationWindow: { startDate: options.startDate, endDate: options.endDate },
    checkedAt: new Date().toISOString(),
    liveRequested: Boolean(options.live), prerequisites, reportingStatus, reporting,
    operationalCohorts: { status: 'not-requested', source: 'scripts/growth/inspect-customer-value.ts', modes: ['cycles', 'acquisition', 'sites', 'sites28'] },
    limitations: [
      'Presence does not prove credential validity, provider permissions, browser build configuration or deployment.',
      'Provider reads use only the existing known FixFlags properties and read-only reporting inspector. No configuration changes or database writes.',
      'GA consent, reporting timezone, provider thresholding and processing lag limit coverage. Search Console uses finalized web-search data.',
      'Missing reports remain unavailable. Browser journeys, operational starts, mature Site cohorts and revenue have separate denominators; no conversion or causal claim is established.',
      'Operational cohorts require the existing local aggregate inspector and a mature observation window. No customer records are loaded here.',
    ],
  }
}
