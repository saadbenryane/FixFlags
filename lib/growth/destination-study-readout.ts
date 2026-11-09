import { z } from 'zod'
import { GUIDE_ANALYZE_EVENT, GUIDE_INDEX_ENTRY, WEBSITE_GUIDE_SLUGS } from '@/lib/analytics/guide-entry'
import { DESTINATION_STUDY_EDITION_SHA256, DESTINATION_STUDY_PATH as PATH, DESTINATION_STUDY_RECEIPT_VERSION,
  PUBLICATION_ORIGIN, destinationStudyDiscoveryVerified } from './destination-study-publication'
import { GUIDE_WITH_STUDY as GUIDE } from '@/lib/marketing/copy/destination-study'
import { AI_REFERRAL_METHOD, FIXFLAGS_GA_WEB_STREAM } from './reporting-targets'
import { readDestinationStudyCommercial } from './destination-study-commercial'

const DAY = 86_400_000
const STUDY_DAYS = 28
const MINIMUM_STARTS = 20
const pacificCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
})
const count = z.number().int().nonnegative()
const status = z.enum(['report-read-succeeded', 'report-read-failed'])
const guide = z.enum([GUIDE_INDEX_ENTRY, ...WEBSITE_GUIDE_SLUGS])
const MAX_GUIDE_ROWS = WEBSITE_GUIDE_SLUGS.length + 1
const finalizedSearchWindow = z.object({
  method: z.literal('unfiltered-final-web-by-date'),
  timeZone: z.literal('America/Los_Angeles'),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  status: z.enum(['confirmed', 'partial', 'unavailable']),
  expectedDays: count,
  observedDays: count.nullable(),
  firstMissingDate: z.iso.date().nullable(),
})
const providerReport = z.object({
  fetchedAt: z.iso.datetime(),
  observationWindow: z.object({ startDate: z.iso.date(), endDate: z.iso.date() }),
  databaseWritten: z.literal(false),
  guide: z.object({ path: z.literal(PATH), canonicalUrl: z.literal(`https://fixflags.com${PATH}`), ga4WebStreamId: z.string().optional() }),
  searchConsole: z.object({ status, property: z.literal('sc-domain:fixflags.com').optional(),
    pageAggregationConfirmed: z.boolean().optional(),
    finalizedWindow: finalizedSearchWindow.optional(),
    metrics: z.object({ clicks: count, impressions: count }).refine(row => row.clicks <= row.impressions).nullish() }),
  ga4: z.object({ status, providerLimited: z.boolean().optional(), metrics: z.object({ screenPageViews: count.optional() }).optional() }),
  analyzeClicks: z.object({ status, eventName: z.literal(GUIDE_ANALYZE_EVENT), providerLimited: z.boolean().optional(), count: count.nullable() }),
  landingSessions: z.object({ status, dimension: z.literal('landingPage'), providerLimited: z.boolean().optional(), count: count.nullable() }).optional(),
  aiReferralSessions: z.object({ status, method: z.literal(AI_REFERRAL_METHOD), ga4WebStreamId: z.string(),
    scope: z.enum(['sitewide', 'guide-landing-page']), providerLimited: z.boolean().optional(), count: count.nullable() }).optional(),
})
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** The Pacific day before the UTC release label overlaps that UTC day. */
export function destinationStudySearchWindows(releasedOn: string) {
  const release = Date.parse(z.iso.date().parse(releasedOn))
  const date = (offset: number) => isoDay(new Date(release + offset * DAY))
  return {
    baseline: { startDate: date(-STUDY_DAYS - 1), endDate: date(-2) },
    postRelease: { startDate: date(1), endDate: date(STUDY_DAYS) },
  }
}

function searchEvidence(report: z.infer<typeof providerReport>) {
  const { searchConsole, observationWindow } = report
  const reported = searchConsole.status === 'report-read-succeeded' && searchConsole.property === 'sc-domain:fixflags.com' &&
    searchConsole.pageAggregationConfirmed ? searchConsole.metrics ?? null : null
  const coverage = searchConsole.finalizedWindow ?? null
  const { startDate, endDate } = observationWindow
  const fetched = Object.fromEntries(pacificCalendar.formatToParts(new Date(report.fetchedAt)).map(part => [part.type, part.value]))
  const fetchedDate = `${fetched.year}-${fetched.month}-${fetched.day}`
  const confirmed = coverage?.status === 'confirmed' && fetchedDate > endDate &&
    coverage.startDate === startDate && coverage.endDate === endDate &&
    coverage.expectedDays === (Date.parse(endDate) - Date.parse(startDate)) / DAY + 1 &&
    coverage.observedDays === coverage.expectedDays && coverage.firstMissingDate === null
  return { reported, coverage, confirmed, finalized: confirmed ? reported : null }
}

function compareSearchWindows(baselineWindow: ReturnType<typeof destinationStudySearchWindows>['baseline'], baselineReporting: unknown,
  postRelease: ReturnType<typeof searchEvidence>['finalized'], editionObserved: boolean) {
  if (baselineReporting === undefined) return { status: 'baseline-not-supplied', baselineWindow }
  const baseline = providerReport.parse(baselineReporting)
  if (baseline.observationWindow.startDate !== baselineWindow.startDate || baseline.observationWindow.endDate !== baselineWindow.endDate) {
    return { status: 'baseline-window-mismatch', baselineWindow }
  }
  const evidence = searchEvidence(baseline)
  const source = { baselineWindow, baselineFetchedAt: baseline.fetchedAt, baselineCoverage: evidence.coverage }
  if (!evidence.reported) return { ...source, status: 'baseline-search-unavailable' }
  if (!evidence.finalized) return { ...source, status: 'baseline-coverage-unconfirmed', baselineReportedSearch: evidence.reported }
  if (!editionObserved) return { ...source, status: 'release-observations-unverified', baselineSearch: evidence.finalized }
  if (!postRelease) return { ...source, status: 'post-release-search-unavailable', baselineSearch: evidence.finalized }
  return { ...source, status: 'comparable', baselineSearch: evidence.finalized, change: {
    clicks: postRelease.clicks - evidence.finalized.clicks,
    impressions: postRelease.impressions - evidence.finalized.impressions,
  } }
}
const cohort = z.object({
  version: z.literal(1),
  status: z.enum(['available', 'partial']),
  cohortStart: z.iso.datetime(),
  cohortEndExclusive: z.iso.datetime(),
  asOf: z.iso.datetime(),
  fullyMature: z.boolean(),
  databaseWritten: z.literal(false),
})
const acquisitionReport = cohort.extend({
  unit: z.literal('anonymous-initial-analysis'),
  followupDays: z.literal(7),
  guideEntries: z.array(z.object({ guide, starts: count, analysisCompletionReceipts: count, claimReceipts: count,
    claimReceiptsWithCompletionReceipt: count.optional(),
    processingEvidence: z.object({
      receiptWithinFollowup: count, completedAuditWithinFollowupWithoutReceipt: count,
      completedAuditAfterFollowupWithoutReceipt: count, noDatedCompletionWithoutReceipt: count,
    }).optional(),
    processingGaps: z.object({
      failedBeforeRecordedStart: count, failedWithinFollowup: count, failedAfterFollowup: count,
      failedWithoutUsableTime: count, recordedNonterminal: count, unverifiedAuditState: count,
    }).optional(),
  })).max(MAX_GUIDE_ROWS),
})
const siteReport = cohort.extend({
  unit: z.literal('Site with first recorded claim from a consented guide start'),
  followupDays: z.literal(28),
  guideEntries: z.array(z.object({ guide, sites: count, independentlyImproved: count, verifiedPublicLinkRepair: count.optional(),
    comparableScheduledPublicLinkRecheck: count.optional(), publicLinkFailureAfterVerifiedRepair: count.optional(),
    ownerAcknowledgedClipboardHandoff: count.optional(),
    ownerClipboardHandoffWithIndependentResult: count.optional(),
    ownerClipboardHandoffWithVerifiedImprovement: count.optional() })).max(MAX_GUIDE_ROWS),
  nativeOutcomeFollowup: z.object({ guideEntries: z.array(z.object({
    guide, sitesWithVerifiedRecovery: count, sitesWithMatureRecoveryFollowup: count.optional(),
    sitesWithCompletedOwnerWebCheckAfterRecovery: count.optional(),
  })).max(MAX_GUIDE_ROWS) }),
})
const operationalSnapshot = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  method: z.literal('single-read-only-snapshot'),
  acquisition: acquisitionReport,
  sites: siteReport,
})

/** Keep only the registered guide and the fields its decision consumes. */
export function destinationStudyOperationalSnapshot(acquisition: unknown, sites: unknown) {
  const evidence = operationalSnapshot.parse({ version: 2, method: 'single-read-only-snapshot', acquisition, sites })
  evidence.acquisition.guideEntries = evidence.acquisition.guideEntries.filter(row => row.guide === GUIDE)
  evidence.sites.guideEntries = evidence.sites.guideEntries.filter(row => row.guide === GUIDE)
  evidence.sites.nativeOutcomeFollowup.guideEntries = evidence.sites.nativeOutcomeFollowup.guideEntries.filter(row => row.guide === GUIDE)
  return evidence
}

const publicationReport = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(DESTINATION_STUDY_RECEIPT_VERSION)]),
  origin: z.literal(PUBLICATION_ORIGIN), path: z.literal(PATH), observedAt: z.iso.datetime(),
  method: z.literal('public-http-get'),
  state: z.enum(['edition-match', 'edition-mismatch', 'canonical-mismatch', 'absent', 'unavailable']),
  editionSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  discovery: z.object({
    analyzeLink: z.enum(['direct', 'streamed', 'missing']),
    analyzeForm: z.enum(['direct', 'streamed', 'missing', 'unavailable']),
    indexDirective: z.enum(['noindex', 'no-noindex-observed']),
    crawlerRules: z.enum(['allowed', 'blocked', 'sitemap-unadvertised', 'unavailable']).optional(),
    sitemapEntry: z.enum(['edition-date', 'date-mismatch', 'missing-or-ambiguous', 'unavailable']).optional(),
    articleMetadata: z.enum(['edition-matched', 'missing-or-mismatch']).optional(),
    llmsEntry: z.enum(['canonical-guide', 'missing-or-ambiguous', 'unavailable']).optional(),
  }).optional(),
})

function editionObservation(input: unknown, expectedDay: string | null) {
  if (input === undefined) return null
  const receipt = publicationReport.parse(input)
  const editionVerified = Boolean(expectedDay && receipt.state === 'edition-match' &&
    receipt.editionSha256 === DESTINATION_STUDY_EDITION_SHA256 && receipt.observedAt.slice(0, 10) === expectedDay)
  return { observedAt: receipt.observedAt, state: receipt.state, editionVerified,
    discoveryVerified: editionVerified && receipt.version === DESTINATION_STUDY_RECEIPT_VERSION && destinationStudyDiscoveryVerified(receipt.discovery),
    discovery: receipt.discovery ?? null }
}

/** Evaluate the registered decision rule over separate aggregate sources. */
export function destinationStudyReadout(input: { reporting: unknown; releasedOn?: string; publication?: unknown; windowEnd?: unknown;
  baselineReporting?: unknown; commercial?: unknown } &
  ({ operational: unknown } | { acquisition: unknown; sites: unknown })) {
  const reporting = providerReport.parse(input.reporting)
  const reports = 'operational' in input ? operationalSnapshot.parse(input.operational)
    : { version: null, acquisition: acquisitionReport.parse(input.acquisition), sites: siteReport.parse(input.sites) }
  const { acquisition, sites } = reports
  const snapshot = reports.version !== null
  const releasedOn = input.releasedOn === undefined ? null : z.iso.date().parse(input.releasedOn)
  const searchWindows = releasedOn ? destinationStudySearchWindows(releasedOn) : null
  const start = new Date(acquisition.cohortStart)
  const end = new Date(acquisition.cohortEndExclusive)
  const startDay = isoDay(start)
  const endDay = isoDay(new Date(end.getTime() - DAY))
  if (sites.cohortStart !== acquisition.cohortStart || sites.cohortEndExclusive !== acquisition.cohortEndExclusive ||
    ![start, end].every(date => date.toISOString().endsWith('T00:00:00.000Z')) || end.getTime() - start.getTime() !== STUDY_DAYS * DAY ||
    reporting.observationWindow.startDate !== startDay || reporting.observationWindow.endDate !== endDay ||
    Date.parse(reporting.fetchedAt) < end.getTime() ||
    (searchWindows && startDay !== searchWindows.postRelease.startDate)) throw new Error('Mismatched experiment window')
  if (snapshot && acquisition.asOf !== sites.asOf) throw new Error('Mismatched operational snapshot times')
  const commercial = readDestinationStudyCommercial(input.commercial, start, end)

  for (const [report, lag] of [[acquisition, 7], [sites, 35]] as const) {
    const asOf = Date.parse(report.asOf)
    if (asOf < end.getTime() || report.fullyMature !== (asOf >= end.getTime() + lag * DAY)) {
      throw new Error('Inconsistent cohort maturity')
    }
  }
  for (const rows of [acquisition.guideEntries, sites.guideEntries, sites.nativeOutcomeFollowup.guideEntries]) {
    if (new Set(rows.map(row => row.guide)).size !== rows.length) throw new Error('Duplicate guide counts')
  }
  const { reported: reportedSearch, coverage: searchWindow, confirmed: confirmedSearchWindow, finalized: search } = searchEvidence(reporting)
  const ga4ProductionStreamScoped = reporting.guide.ga4WebStreamId === FIXFLAGS_GA_WEB_STREAM
  const aiReferrals = reporting.aiReferralSessions
  const startCounts = acquisition.guideEntries.find(row => row.guide === GUIDE) ?? null
  const siteCounts = sites.guideEntries.find(row => row.guide === GUIDE) ?? null
  const recoveryCounts = sites.nativeOutcomeFollowup.guideEntries.find(row => row.guide === GUIDE) ?? null
  const processingGaps = startCounts?.processingGaps ? Object.values(startCounts.processingGaps).reduce((sum, count) => sum + count, 0) : 0
  const processingEvidence = startCounts?.processingEvidence
  const pairedReceipts = startCounts?.claimReceiptsWithCompletionReceipt
  if ((startCounts && (startCounts.claimReceipts > startCounts.starts || startCounts.analysisCompletionReceipts > startCounts.starts)) ||
    (startCounts && processingGaps + startCounts.analysisCompletionReceipts > startCounts.starts) ||
    (startCounts && processingEvidence && (
      Object.values(processingEvidence).reduce((sum, count) => sum + count, 0) !== startCounts.starts ||
      processingEvidence.receiptWithinFollowup !== startCounts.analysisCompletionReceipts ||
      (startCounts.processingGaps && processingEvidence.noDatedCompletionWithoutReceipt !== processingGaps))) ||
    (startCounts && pairedReceipts !== undefined && (
      pairedReceipts > Math.min(startCounts.claimReceipts, startCounts.analysisCompletionReceipts) ||
      startCounts.claimReceipts + startCounts.analysisCompletionReceipts - pairedReceipts > startCounts.starts)) ||
    (siteCounts?.independentlyImproved ?? 0) > (siteCounts?.sites ?? 0) ||
    (siteCounts?.verifiedPublicLinkRepair ?? 0) > (siteCounts?.independentlyImproved ?? 0) ||
    (siteCounts?.comparableScheduledPublicLinkRecheck ?? 0) > (siteCounts?.verifiedPublicLinkRepair ?? 0) ||
    (siteCounts?.publicLinkFailureAfterVerifiedRepair ?? 0) > (siteCounts?.comparableScheduledPublicLinkRecheck ?? 0) ||
    (siteCounts?.ownerAcknowledgedClipboardHandoff ?? 0) > (siteCounts?.sites ?? 0) ||
    (siteCounts?.ownerClipboardHandoffWithIndependentResult ?? 0) > (siteCounts?.ownerAcknowledgedClipboardHandoff ?? 0) ||
    (siteCounts?.ownerClipboardHandoffWithVerifiedImprovement ?? 0) > (siteCounts?.ownerClipboardHandoffWithIndependentResult ?? 0) ||
    (siteCounts?.ownerClipboardHandoffWithVerifiedImprovement ?? 0) > (siteCounts?.independentlyImproved ?? 0) ||
    (recoveryCounts?.sitesWithVerifiedRecovery ?? 0) > (siteCounts?.sites ?? 0) ||
    (recoveryCounts?.sitesWithMatureRecoveryFollowup ?? 0) > (recoveryCounts?.sitesWithVerifiedRecovery ?? 0) ||
    (recoveryCounts?.sitesWithCompletedOwnerWebCheckAfterRecovery ?? 0) > (recoveryCounts?.sitesWithMatureRecoveryFollowup ?? 0) ||
    (snapshot && (siteCounts?.sites ?? 0) > (startCounts?.claimReceipts ?? 0))) throw new Error('Inconsistent experiment counts')

  const gaps = []
  if (!releasedOn) gaps.push('release-confirmation-missing')
  const publication = editionObservation(input.publication, releasedOn)
  const windowEnd = editionObservation(input.windowEnd, releasedOn ? isoDay(end) : null)
  if (releasedOn) {
    if (!publication?.editionVerified) gaps.push('reviewed-edition-unverified-on-release-date')
    else if (!publication.discoveryVerified) gaps.push('release-discovery-unverified')
    if (!windowEnd?.editionVerified) gaps.push('reviewed-edition-unverified-at-window-end')
    else if (!windowEnd.discoveryVerified) gaps.push('window-end-discovery-unverified')
  }
  if (releasedOn && !snapshot) gaps.push('shared-operational-snapshot-missing')
  if (releasedOn && reports.version === 1) gaps.push('public-link-repair-window-unverified')
  if (!acquisition.fullyMature || !sites.fullyMature) gaps.push('followup-incomplete')
  if (acquisition.status === 'partial' || sites.status === 'partial') gaps.push('operational-coverage-partial')
  if (!reportedSearch) gaps.push('finalized-search-unavailable')
  else if (!confirmedSearchWindow) gaps.push('search-window-coverage-unconfirmed')
  else if (reportedSearch.clicks < 1) gaps.push('no-finalized-search-click')
  if ((startCounts?.starts ?? 0) < MINIMUM_STARTS) gaps.push('guide-start-minimum-unmet')
  if (siteCounts && siteCounts.verifiedPublicLinkRepair === undefined) gaps.push('public-link-repair-evidence-unavailable')
  else if (!siteCounts?.verifiedPublicLinkRepair) gaps.push('verified-public-link-repair-unobserved')

  return {
    version: 1,
    experiment: 'SEO-RESEARCH-001',
    guide: GUIDE,
    minimumMatureGuideStarts: MINIMUM_STARTS,
    operatorConfirmedReleaseDate: releasedOn,
    publication,
    windowEnd,
    window: { firstDate: startDay, lastDate: endDay, utcEndExclusive: end.toISOString() },
    discovery: {
      fetchedAt: reporting.fetchedAt,
      finalizedSearch: search,
      searchWindow,
      ...(!search && reportedSearch ? { reportedSearch } : {}),
      searchComparison: searchWindows ? compareSearchWindows(searchWindows.baseline, input.baselineReporting, search,
        Boolean(publication?.discoveryVerified && windowEnd?.discoveryVerified)) : null,
      ga4ProductionStreamScoped,
      reportedPageviews: ga4ProductionStreamScoped && reporting.ga4.status === 'report-read-succeeded' && reporting.ga4.providerLimited === false
        ? reporting.ga4.metrics?.screenPageViews ?? null : null,
      reportedLandingSessions: ga4ProductionStreamScoped && reporting.landingSessions?.status === 'report-read-succeeded' &&
        reporting.landingSessions.providerLimited === false ? reporting.landingSessions.count : null,
      reportedAiReferralLandingSessions: ga4ProductionStreamScoped && aiReferrals?.scope === 'guide-landing-page' &&
        aiReferrals.ga4WebStreamId === FIXFLAGS_GA_WEB_STREAM && aiReferrals.status === 'report-read-succeeded' &&
        aiReferrals.providerLimited === false ? aiReferrals.count : null,
      consentedAnalyzeClicks: ga4ProductionStreamScoped && reporting.analyzeClicks.status === 'report-read-succeeded' && reporting.analyzeClicks.providerLimited === false
        ? reporting.analyzeClicks.count : null,
    },
    operational: { method: snapshot ? 'single-read-only-snapshot' : 'separate-reports', snapshotVersion: reports.version,
      acquisitionAsOf: acquisition.asOf, sitesAsOf: sites.asOf, startCounts, siteCounts, recoveryCounts },
    commercial,
    decision: gaps.length ? 'inconclusive' : 'directional-evidence-threshold-met',
    gaps,
    limitations: [
      'Provider calendars and UTC cohort dates use matching labels. The aggregate sources remain separate.',
      'Search Console window coverage requires an unfiltered finalized web row for every property date. Omitted dates leave coverage unconfirmed.',
      'The search comparison reports differences between two complete 28-day windows. The baseline excludes Pacific dates that may overlap the UTC release day.',
      'Release and window-end HTTP observations establish the technical discovery signals at those two times. Indexing, crawler visits, and successful form submission remain unobserved.',
      'The release date is an operator assertion. Directional evidence does not establish causal lift or paid conversion.',
    ],
  }
}
