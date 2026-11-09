import { describe, expect, it } from 'vitest'
import { destinationStudyOperationalSnapshot, destinationStudyReadout, destinationStudySearchWindows } from '../destination-study-readout'
import { DESTINATION_STUDY_EDITION_SHA256 } from '../destination-study-publication'

function fixture() {
  const guide = 'website-online-but-not-working'
  const cohort = { version: 1, status: 'available', cohortStart: '2026-10-09T00:00:00.000Z',
    cohortEndExclusive: '2026-11-06T00:00:00.000Z', asOf: '2026-12-11T00:00:00.000Z',
    fullyMature: true, databaseWritten: false }
  const publication = { version: 4, origin: 'https://fixflags.com', path: `/guides/${guide}`, method: 'public-http-get',
    observedAt: '2026-10-08T12:00:00.000Z', state: 'edition-match', editionSha256: DESTINATION_STUDY_EDITION_SHA256,
    discovery: { analyzeLink: 'streamed', analyzeForm: 'direct', indexDirective: 'no-noindex-observed',
      crawlerRules: 'allowed', sitemapEntry: 'edition-date', articleMetadata: 'edition-matched', llmsEntry: 'canonical-guide' } }
  return {
    releasedOn: '2026-10-08',
    publication,
    windowEnd: { ...publication, observedAt: '2026-11-06T12:00:00.000Z' },
    reporting: {
      observationWindow: { startDate: '2026-10-09', endDate: '2026-11-05' },
      fetchedAt: '2026-11-09T12:00:00.000Z', databaseWritten: false,
      guide: { path: `/guides/${guide}`, canonicalUrl: `https://fixflags.com/guides/${guide}`, ga4WebStreamId: '15085844419' as string | undefined },
      searchConsole: { status: 'report-read-succeeded', property: 'sc-domain:fixflags.com', pageAggregationConfirmed: true,
        finalizedWindow: { method: 'unfiltered-final-web-by-date', timeZone: 'America/Los_Angeles', startDate: '2026-10-09', endDate: '2026-11-05',
          status: 'confirmed', expectedDays: 28, observedDays: 28, firstMissingDate: null as string | null },
        metrics: { clicks: 1, impressions: 9 } },
      ga4: { status: 'report-read-succeeded', providerLimited: true, metrics: { screenPageViews: 10 } },
      analyzeClicks: { status: 'report-read-succeeded', providerLimited: false, eventName: 'guide_analyze_clicked', count: 3 },
      landingSessions: { status: 'report-read-succeeded', dimension: 'landingPage', providerLimited: false, count: 7 },
    },
    acquisition: { ...cohort, unit: 'anonymous-initial-analysis', followupDays: 7,
      guideEntries: [{ guide, starts: 20, analysisCompletionReceipts: 16, claimReceipts: 2, privateAuditId: 'hidden',
        processingGaps: { failedBeforeRecordedStart: 0, failedWithinFollowup: 3, failedAfterFollowup: 0,
          failedWithoutUsableTime: 0, recordedNonterminal: 1, unverifiedAuditState: 0 },
      }] },
    sites: { ...cohort, unit: 'Site with first recorded claim from a consented guide start', followupDays: 28,
      guideEntries: [{ guide, sites: 2, independentlyImproved: 1, verifiedPublicLinkRepair: 1 as number | undefined }],
      nativeOutcomeFollowup: { guideEntries: [{ guide, sitesWithVerifiedRecovery: 1 }] } },
  }
}

function snapshot(input: ReturnType<typeof fixture>) {
  return { reporting: input.reporting, publication: input.publication, windowEnd: input.windowEnd, releasedOn: input.releasedOn,
    operational: destinationStudyOperationalSnapshot(input.acquisition, input.sites) }
}

function commercialFixture() {
  return {
    version: 1, source: 'retained-billing-ledger-and-optional-live-stripe-capture-read', databaseWritten: false, providerWritten: false,
    ledgerWindow: { since: '2026-10-09T00:00:00.000Z', asOf: '2026-12-12T00:00:00.000Z' },
    guideCohort: { guide: 'website-online-but-not-working', firstStartDay: '2026-10-09',
      cohortEndExclusive: '2026-11-06T00:00:00.000Z', fullyMatureAt: '2026-12-11T00:00:00.000Z',
      fullyMature: true, billingEvidenceThrough: '2026-12-11T00:00:00.000Z' },
    claimCohort: { status: 'available', followupDays: 28, counts: { matureExactClaimOwners: 1,
      ownersWithCurrentBillingCustomer: 1, ownersWithRetainedPositiveCurrentCustomerInvoice: 1 } },
    verification: { status: 'attempted', confirmedCaptures: 2, failedReads: 0, incompatibleCaptures: 0, duplicateCaptureEntries: 0,
      confirmedGrossMinorByCurrency: [{ grossMinor: 19000 }], rawCustomer: 'private-customer' },
    postClaimInvoices: { followupDays: 28, invoiceCandidates: 2, invoiceReadFailures: 0, incompatibleInvoices: 0,
      verifiedPaidInvoices: 2, ownersWithVerifiedPaidInvoice: 1, rawInvoice: 'private-invoice' },
  }
}

describe('destination study readout', () => {
  it('attaches exact-window commercial evidence as a separate account milestone', () => {
    const input = snapshot(fixture())
    const result = destinationStudyReadout({ ...input, commercial: commercialFixture() })
    expect(result).toMatchObject({ decision: 'directional-evidence-threshold-met',
      commercial: { asOf: '2026-12-12T00:00:00.000Z', claimCohortStatus: 'available',
        counts: { matureExactClaimOwners: 1 }, postClaimInvoices: { verifiedPaidInvoices: 2, ownersWithVerifiedPaidInvoice: 1 } },
      operational: { siteCounts: { sites: 2 } } })
    expect(JSON.stringify(result)).not.toMatch(/private-customer|private-invoice|grossMinor/)
    expect(destinationStudyReadout(input).commercial).toBeNull()
  })

  it('leaves immature commercial observations unavailable and rejects unrelated or inconsistent receipts', () => {
    const input = snapshot(fixture())
    const commercial = commercialFixture()
    const asOf = '2026-12-10T00:00:00.000Z'
    const immature = { ...commercial, ledgerWindow: { ...commercial.ledgerWindow, asOf },
      guideCohort: { ...commercial.guideCohort, fullyMature: false, billingEvidenceThrough: asOf },
      claimCohort: { ...commercial.claimCohort, status: 'guide-followup-incomplete', counts: null },
      verification: { ...commercial.verification, status: 'guide-followup-incomplete', confirmedCaptures: null },
      postClaimInvoices: { ...commercial.postClaimInvoices, invoiceCandidates: 0, verifiedPaidInvoices: null, ownersWithVerifiedPaidInvoice: null },
    }
    expect(destinationStudyReadout({ ...input, commercial: immature })).toMatchObject({
      decision: 'directional-evidence-threshold-met',
      commercial: { fullyMature: false, counts: null, postClaimInvoices: { verifiedPaidInvoices: null } },
    })
    for (const mismatch of [
      { guideCohort: { ...commercial.guideCohort, guide: 'checking-after-publishing' } },
      { guideCohort: { ...commercial.guideCohort, cohortEndExclusive: '2026-11-07T00:00:00.000Z' } },
      { guideCohort: { ...commercial.guideCohort, billingEvidenceThrough: commercial.ledgerWindow.asOf } },
      { postClaimInvoices: { ...commercial.postClaimInvoices, ownersWithVerifiedPaidInvoice: 2 } },
      { verification: { ...commercial.verification, status: 'test-credential' } },
    ]) {
      expect(() => destinationStudyReadout({ ...input, commercial: { ...commercial, ...mismatch } })).toThrow()
    }
  })

  it('passes the registered boundary while keeping search, analytics and customer evidence separate', () => {
    const result = destinationStudyReadout(snapshot(fixture()))
    expect(result).toMatchObject({
      decision: 'directional-evidence-threshold-met', gaps: [],
      discovery: { finalizedSearch: { clicks: 1, impressions: 9 }, reportedPageviews: null,
        reportedLandingSessions: 7, consentedAnalyzeClicks: 3 },
      operational: { method: 'single-read-only-snapshot', snapshotVersion: 2, startCounts: { starts: 20, processingGaps: { failedWithinFollowup: 3, recordedNonterminal: 1 } },
        siteCounts: { sites: 2, independentlyImproved: 1, verifiedPublicLinkRepair: 1 },
        recoveryCounts: { sitesWithVerifiedRecovery: 1 } },
    })
    expect(JSON.stringify(result)).not.toContain('hidden')
  })

  it('keeps earlier or unrelated stream counts out of the guide metrics without changing the decision', () => {
    const input = fixture()
    input.reporting.ga4.providerLimited = false
    expect(destinationStudyReadout(snapshot(input)).discovery).toMatchObject({ ga4ProductionStreamScoped: true,
      reportedPageviews: 10, consentedAnalyzeClicks: 3 })
    for (const stream of [undefined, 'another-stream']) {
      input.reporting.guide.ga4WebStreamId = stream
      expect(destinationStudyReadout(snapshot(input))).toMatchObject({ decision: 'directional-evidence-threshold-met',
        discovery: { ga4ProductionStreamScoped: false, reportedPageviews: null,
          reportedLandingSessions: null, consentedAnalyzeClicks: null } })
    }
  })

  it('withholds landing sessions from older, limited or failed provider receipts', () => {
    const input = fixture()
    for (const landingSessions of [undefined, { ...input.reporting.landingSessions, providerLimited: true },
      { ...input.reporting.landingSessions, status: 'report-read-failed', count: null }]) {
      const readout = destinationStudyReadout({ ...snapshot(input), reporting: { ...input.reporting, landingSessions } })
      expect(readout).toMatchObject({ decision: 'directional-evidence-threshold-met', discovery: { reportedLandingSessions: null } })
    }
  })

  it('uses only a production guide-scoped AI referral report for the guide readout', () => {
    const input = fixture()
    const aiReferralSessions = { method: 'ga4-session-source-referral-v1', ga4WebStreamId: '15085844419',
      scope: 'guide-landing-page', status: 'report-read-succeeded', providerLimited: false, count: 2 }
    const read = (overrides: Record<string, unknown>) =>
      destinationStudyReadout({ ...snapshot(input), reporting: { ...input.reporting, aiReferralSessions: { ...aiReferralSessions, ...overrides } } })
    expect(read({})).toMatchObject({ decision: 'directional-evidence-threshold-met', discovery: { reportedAiReferralLandingSessions: 2 } })
    for (const overrides of [{ scope: 'sitewide' }, { ga4WebStreamId: 'unrelated' }, { providerLimited: true }, { count: null }]) {
      expect(read(overrides).discovery.reportedAiReferralLandingSessions).toBeNull()
    }
  })

  it('retains the guide processing partition and paired receipts, rejecting impossible counts', () => {
    const input = fixture()
    const processingEvidence = { receiptWithinFollowup: 16, completedAuditWithinFollowupWithoutReceipt: 0,
      completedAuditAfterFollowupWithoutReceipt: 0, noDatedCompletionWithoutReceipt: 4 }
    const read = (row: Record<string, unknown>) => {
      const acquisition = { ...input.acquisition, guideEntries: [{ ...input.acquisition.guideEntries[0], ...row }] }
      return destinationStudyReadout({ ...snapshot(input), operational: destinationStudyOperationalSnapshot(acquisition, input.sites) })
    }
    expect(read({ processingEvidence, claimReceiptsWithCompletionReceipt: 1 })).toMatchObject({
      operational: { startCounts: { processingEvidence, claimReceiptsWithCompletionReceipt: 1 } },
      decision: 'directional-evidence-threshold-met',
    })
    expect(read({}).operational.startCounts).not.toHaveProperty('claimReceiptsWithCompletionReceipt')
    expect(() => read({ claimReceiptsWithCompletionReceipt: 3 })).toThrow('Inconsistent experiment counts')
    expect(() => read({ claimReceipts: 6, claimReceiptsWithCompletionReceipt: 1 })).toThrow('Inconsistent experiment counts')
    expect(() => read({ processingEvidence: { ...processingEvidence, receiptWithinFollowup: 15 } })).toThrow('Inconsistent experiment counts')
    expect(() => read({ processingEvidence: { ...processingEvidence, noDatedCompletionWithoutReceipt: 3,
      completedAuditAfterFollowupWithoutReceipt: 1 } })).toThrow('Inconsistent experiment counts')
  })

  it('requires the exact edition on the first day after the cohort window', () => {
    const input = fixture()
    for (const windowEnd of [undefined, input.publication,
      { ...input.windowEnd, observedAt: '2026-11-07T00:00:00.000Z' },
      { ...input.windowEnd, state: 'edition-mismatch' },
    ]) {
      expect(destinationStudyReadout({ ...snapshot(input), windowEnd })).toMatchObject({
        decision: 'inconclusive', gaps: ['reviewed-edition-unverified-at-window-end'],
      })
    }
  })

  it('preserves a reported click while withholding direction without full finalized date coverage', () => {
    const input = fixture()
    const { finalizedWindow, ...searchConsole } = input.reporting.searchConsole
    const operational = snapshot(input)
    for (const coverage of [
      undefined,
      { ...finalizedWindow, status: 'partial', observedDays: 27, firstMissingDate: '2026-11-05' },
      { ...finalizedWindow, expectedDays: 27, observedDays: 27 },
      { ...finalizedWindow, observedDays: 27 },
      { ...finalizedWindow, startDate: '2026-10-10', endDate: '2026-11-06' },
    ]) {
      expect(destinationStudyReadout({ ...operational, reporting: {
        ...input.reporting, searchConsole: { ...searchConsole, finalizedWindow: coverage },
      } })).toMatchObject({
        decision: 'inconclusive', gaps: ['search-window-coverage-unconfirmed'],
        discovery: { finalizedSearch: null, reportedSearch: { clicks: 1, impressions: 9 } },
      })
    }
    input.reporting.searchConsole.metrics.clicks = 0
    expect(destinationStudyReadout(snapshot(input))).toMatchObject({
      decision: 'inconclusive', gaps: ['no-finalized-search-click'], discovery: { finalizedSearch: { clicks: 0, impressions: 9 } },
    })
    input.reporting.searchConsole.metrics.clicks = 10
    expect(() => destinationStudyReadout(snapshot(input))).toThrow()
  })

  it('excludes Pacific dates that can overlap the UTC release day, including across a clock change', () => {
    expect(destinationStudySearchWindows('2026-11-01')).toEqual({
      baseline: { startDate: '2026-10-03', endDate: '2026-10-30' },
      postRelease: { startDate: '2026-11-02', endDate: '2026-11-29' },
    })
  })

  it('reports absolute search changes only for the exact finalized baseline and verified release window', () => {
    const input = fixture()
    const observationWindow = { startDate: '2026-09-09', endDate: '2026-10-06' }
    const baseline = { ...input.reporting, observationWindow, fetchedAt: '2026-10-09T18:00:00.000Z',
      searchConsole: { ...input.reporting.searchConsole, metrics: { clicks: 0, impressions: 12 },
        finalizedWindow: { ...input.reporting.searchConsole.finalizedWindow, ...observationWindow } } }
    const experiment = snapshot(input)
    const read = (baselineReporting?: unknown) => destinationStudyReadout({ ...experiment, baselineReporting })
    expect(read(baseline)).toMatchObject({
      decision: 'directional-evidence-threshold-met',
      discovery: { searchComparison: { status: 'comparable', baselineWindow: observationWindow,
        baselineSearch: { clicks: 0, impressions: 12 }, change: { clicks: 1, impressions: -3 } } },
    })
    expect(read().discovery.searchComparison).toEqual({ status: 'baseline-not-supplied', baselineWindow: observationWindow })
    const { finalizedWindow, ...searchConsole } = baseline.searchConsole
    for (const [receipt, expectedStatus] of [
      [{ ...baseline, observationWindow: { startDate: '2026-09-10', endDate: '2026-10-07' } }, 'baseline-window-mismatch'],
      [{ ...baseline, searchConsole }, 'baseline-coverage-unconfirmed'],
      [{ ...baseline, fetchedAt: '2026-10-07T06:59:59.999Z' }, 'baseline-coverage-unconfirmed'],
      [{ ...baseline, searchConsole: { ...searchConsole, finalizedWindow, metrics: null } }, 'baseline-search-unavailable'],
    ] as const) {
      const result = read(receipt)
      expect(result.decision).toBe('directional-evidence-threshold-met')
      expect(result.discovery.searchComparison).toMatchObject({ status: expectedStatus })
      expect(result.discovery.searchComparison).not.toHaveProperty('change')
    }
    expect(destinationStudyReadout({ ...experiment, windowEnd: undefined, baselineReporting: baseline }).discovery.searchComparison)
      .toMatchObject({ status: 'release-observations-unverified' })
    const searchConsoleWithoutCoverage = { ...input.reporting.searchConsole, finalizedWindow: undefined }
    expect(destinationStudyReadout({ ...experiment, reporting: { ...input.reporting, searchConsole: searchConsoleWithoutCoverage },
      baselineReporting: baseline }).discovery.searchComparison).toMatchObject({ status: 'post-release-search-unavailable' })
  })

  it('preserves matched clipboard follow-up and requires it to fit the acknowledged and improved Site counts', () => {
    const input = fixture()
    const counts = { ...input.sites.guideEntries[0], independentlyImproved: 1, ownerAcknowledgedClipboardHandoff: 2,
      ownerClipboardHandoffWithIndependentResult: 1, ownerClipboardHandoffWithVerifiedImprovement: 1 }
    const read = (entry: typeof counts) => destinationStudyReadout(snapshot({
      ...input, sites: { ...input.sites, guideEntries: [entry] },
    }))
    expect(read(counts).operational.siteCounts).toEqual(counts)
    for (const correction of [{ ownerAcknowledgedClipboardHandoff: 0 }, { ownerClipboardHandoffWithIndependentResult: 0 },
      { independentlyImproved: 0 }]) {
      expect(() => read({ ...counts, ...correction })).toThrow('Inconsistent experiment counts')
    }
  })

  it('reports verified public-link repairs as a subset of independently improved Sites', () => {
    const input = fixture()
    const entry = { ...input.sites.guideEntries[0], independentlyImproved: 1, verifiedPublicLinkRepair: 1,
      comparableScheduledPublicLinkRecheck: 1, publicLinkFailureAfterVerifiedRepair: 1 }
    const read = (correction: Partial<typeof entry> = {}) => {
      const guideEntries = [{ ...entry, ...correction }]
      return destinationStudyReadout(snapshot({ ...input, sites: { ...input.sites, guideEntries } }))
    }
    expect(read()).toMatchObject({
      decision: 'directional-evidence-threshold-met', operational: { siteCounts: entry },
    })
    expect(read({ publicLinkFailureAfterVerifiedRepair: 0 }).decision).toBe(read().decision)
    for (const correction of [{ verifiedPublicLinkRepair: 2 }, { comparableScheduledPublicLinkRecheck: 0 },
      { comparableScheduledPublicLinkRecheck: 2 }]) {
      expect(() => read(correction)).toThrow('Inconsistent experiment counts')
    }
  })

  it('keeps unrelated improvements and native recoveries outside the decision', () => {
    const input = fixture()
    input.sites.guideEntries[0].verifiedPublicLinkRepair = 0
    expect(destinationStudyReadout(snapshot(input))).toMatchObject({
      decision: 'inconclusive', gaps: ['verified-public-link-repair-unobserved'],
      operational: { siteCounts: { independentlyImproved: 1, verifiedPublicLinkRepair: 0 },
        recoveryCounts: { sitesWithVerifiedRecovery: 1 } },
    })
    input.sites.guideEntries[0].verifiedPublicLinkRepair = undefined
    expect(destinationStudyReadout(snapshot(input))).toMatchObject({
      decision: 'inconclusive', gaps: ['public-link-repair-evidence-unavailable'],
    })
  })

  it('withholds direction when the edition matches but the Analyze path or index directive fails', () => {
    const input = fixture()
    expect(destinationStudyReadout({ ...snapshot(input), publication: { ...input.publication, version: 3 } })).toMatchObject({
      decision: 'inconclusive', gaps: ['release-discovery-unverified'],
    })
    for (const discovery of [undefined, { ...input.windowEnd.discovery, analyzeForm: 'unavailable' },
      { ...input.windowEnd.discovery, analyzeLink: 'missing' }, { ...input.windowEnd.discovery, indexDirective: 'noindex' },
      { ...input.windowEnd.discovery, crawlerRules: 'blocked' }, { ...input.windowEnd.discovery, sitemapEntry: 'date-mismatch' },
      { ...input.windowEnd.discovery, articleMetadata: 'missing-or-mismatch' },
      { ...input.windowEnd.discovery, llmsEntry: 'missing-or-ambiguous' },
    ]) {
      expect(destinationStudyReadout({ ...snapshot(input), windowEnd: { ...input.windowEnd, discovery } })).toMatchObject({
        decision: 'inconclusive', gaps: ['window-end-discovery-unverified'],
      })
    }
  })

  it('requires a release date, full follow-up, the exact guide, and available evidence', () => {
    const input = fixture()
    input.sites.asOf = '2026-12-10T00:00:00.000Z'
    input.sites.fullyMature = false
    input.acquisition.status = 'partial'
    input.acquisition.guideEntries[0].guide = 'checking-after-publishing'
    input.reporting.searchConsole.pageAggregationConfirmed = false
    input.sites.nativeOutcomeFollowup.guideEntries = []
    input.sites.guideEntries = []
    expect(destinationStudyReadout({ ...input, releasedOn: undefined })).toMatchObject({
      decision: 'inconclusive', operational: { startCounts: null, recoveryCounts: null },
      gaps: ['release-confirmation-missing', 'followup-incomplete', 'operational-coverage-partial',
        'finalized-search-unavailable', 'guide-start-minimum-unmet', 'verified-public-link-repair-unobserved'],
    })
  })

  it('withholds the result when the publication observation is missing, mismatched, or on a different date', () => {
    const input = fixture()
    for (const publication of [undefined,
      { ...input.publication, observedAt: '2026-10-07T12:00:00.000Z' },
      { ...input.publication, editionSha256: '0'.repeat(64) },
      { ...input.publication, state: 'absent' },
    ]) {
      expect(destinationStudyReadout({ ...snapshot(input), publication })).toMatchObject({
        decision: 'inconclusive', gaps: ['reviewed-edition-unverified-on-release-date'],
      })
    }
  })

  it('withholds a release decision from separately collected operational files', () => {
    expect(destinationStudyReadout(fixture())).toMatchObject({
      decision: 'inconclusive', gaps: ['shared-operational-snapshot-missing'],
    })
  })

  it('retains old snapshot counts while requiring a fresh repair-window read for the release decision', () => {
    const input = snapshot(fixture())
    const result = destinationStudyReadout({ ...input, operational: { ...input.operational, version: 1 } })
    expect(result).toMatchObject({ decision: 'inconclusive', gaps: ['public-link-repair-window-unverified'],
      operational: { snapshotVersion: 1, siteCounts: { verifiedPublicLinkRepair: 1 } } })
  })

  it('rejects a later window or a bundled Site count that cannot come from its exact claims', () => {
    const later = fixture()
    later.releasedOn = '2026-10-07'
    expect(() => destinationStudyReadout(snapshot(later))).toThrow('Mismatched experiment window')
    const mismatched = fixture()
    mismatched.acquisition.guideEntries[0].claimReceipts = 1
    expect(() => destinationStudyReadout(snapshot(mismatched))).toThrow('Inconsistent experiment counts')
    const mixed = fixture()
    mixed.acquisition.asOf = '2026-12-12T00:00:00.000Z'
    expect(() => destinationStudyReadout(snapshot(mixed))).toThrow('Mismatched operational snapshot times')
    const overlapping = fixture()
    overlapping.acquisition.guideEntries[0].processingGaps.failedAfterFollowup = 1
    expect(() => destinationStudyReadout(snapshot(overlapping))).toThrow('Inconsistent experiment counts')
  })

  it('requires owner follow-up counts to fit the mature recovered cohort', () => {
    const input = fixture()
    const row = input.sites.nativeOutcomeFollowup.guideEntries[0]
    const operational = snapshot(input).operational
    const counts = { ...row, sitesWithMatureRecoveryFollowup: 1, sitesWithCompletedOwnerWebCheckAfterRecovery: 1 }
    const withRecoveryCounts = (entry: typeof counts) => ({ ...snapshot(input),
      operational: { ...operational, sites: { ...operational.sites, nativeOutcomeFollowup: { guideEntries: [entry] } } },
    })
    expect(destinationStudyReadout(withRecoveryCounts(counts)).operational.recoveryCounts).toEqual(counts)
    expect(() => destinationStudyReadout(withRecoveryCounts({ ...counts, sitesWithMatureRecoveryFollowup: 0 })))
      .toThrow('Inconsistent experiment counts')
    expect(() => destinationStudyReadout(withRecoveryCounts({ ...counts, sitesWithMatureRecoveryFollowup: 2 })))
      .toThrow('Inconsistent experiment counts')
  })

  it.each(['scope', 'dates', 'release', 'maturity', 'counts', 'duplicate'])('rejects incompatible evidence (%s)', scenario => {
    const input = fixture()
    if (scenario === 'scope') input.reporting.guide.path = '/guides/checking-after-publishing'
    if (scenario === 'dates') input.reporting.observationWindow.endDate = '2026-11-06'
    if (scenario === 'release') input.releasedOn = '2026-10-09'
    if (scenario === 'maturity') input.sites.fullyMature = false
    if (scenario === 'counts') input.sites.nativeOutcomeFollowup.guideEntries[0].sitesWithVerifiedRecovery = 3
    if (scenario === 'duplicate') input.acquisition.guideEntries.push(input.acquisition.guideEntries[0])
    expect(() => destinationStudyReadout(input)).toThrow()
  })
})
