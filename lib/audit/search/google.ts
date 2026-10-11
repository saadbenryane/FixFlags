import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executionTransaction, executionWrite } from '@/lib/audit/execution-ownership'
import { accessTokenForConnection } from '@/lib/sites/connections/google'
import { searchPropertyCoversUrl } from '@/lib/sites/connections/match'
import { getGscAccessToken, inspectSearchUrl, querySearchAnalytics, SearchConsoleError, type SearchUrlInspection, type GscSearchRow } from '@/lib/integrations/google-search-console'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { searchObservationSchema, searchReceiptSchema, type SearchObservation, type SearchReceipt } from './contracts'
import { searchFindings } from './registry'

type Failure = keyof typeof C.googleFailures
type GoogleReceiptModule = 'search-google' | 'search-google-index' | 'search-google-performance'
type GoogleAccess = { token: string; property: string; connectionId: string | null; legacyUserId: string | null }

function providerObservation(pageUrl: string, input: {
  checkId: string; source: 'google-index' | 'google-analytics'; disposition: SearchObservation['disposition'];
  reason: string; observed: string; attention?: SearchObservation['attention']['kind']; collectedAt: string; locator: string;
  google?: SearchObservation['google'];
}): SearchObservation {
  const rule = input.source === 'google-index' ? C.rules.google : C.rules.performance
  return searchObservationSchema.parse({ id: `${input.checkId}:${input.source}`, checkId: input.checkId, checkVersion: 1,
    responsibility: 'google', name: rule.name, disposition: input.disposition, reason: input.reason,
    expected: rule.expected, observed: input.observed, source: input.source, collectedAt: input.collectedAt, pageUrl,
    attention: { policy: 'search', version: 1, kind: input.attention ?? 'observation', reason: input.reason },
    evidence: [{ source: input.source, url: pageUrl, locator: input.locator, excerpt: input.observed.slice(0, 2000), collectedAt: input.collectedAt }],
    limitation: C.googleLimit, guidance: rule.guidance, google: input.google })
}

function failed(pageUrl: string, failure: Failure, source: 'google-index' | 'google-analytics', collectedAt: string) {
  return providerObservation(pageUrl, { checkId: source === 'google-index' ? 'search-google-index' : 'search-google-performance',
    source, disposition: 'unknown', reason: failure, observed: C.googleFailures[failure], collectedAt, locator: 'provider response' })
}

async function googleAccess(projectId: string, userId: string): Promise<GoogleAccess | Failure> {
  const connection = await prisma.siteConnection.findUnique({ where: { projectId_provider: { projectId, provider: 'SEARCH_CONSOLE' } } })
  if (connection) {
    // A revoked or refused Site connection never falls through to broader legacy credentials.
    if (connection.status === 'REVOKED') return 'NOT_CONNECTED'
    if (connection.status === 'MISMATCH' || !connection.propertyId) return 'PROPERTY_MISMATCH'
    if (connection.status !== 'CONNECTED') return 'AUTH_EXPIRED'
    try {
      const token = await accessTokenForConnection(connection)
      return token ? { token, property: connection.propertyId, connectionId: connection.id, legacyUserId: null } : 'AUTH_EXPIRED'
    } catch { return 'AUTH_EXPIRED' }
  }
  const legacy = await prisma.gscConnection.findUnique({ where: { userId }, select: { siteUrl: true } })
  if (!legacy) return 'NOT_CONNECTED'
  const token = await getGscAccessToken(userId)
  return token ? { token, property: legacy.siteUrl, connectionId: null, legacyUserId: userId } : 'AUTH_EXPIRED'
}

function failureCode(error: unknown): Failure {
  return error instanceof SearchConsoleError ? error.code : 'PROVIDER_UNAVAILABLE'
}

/** Provider facts and their receipt commit together, with one writer for each Audit/page. */
async function persistGoogle(receipt: SearchReceipt, access: GoogleAccess | null, inspection: SearchUrlInspection | null, rows: GscSearchRow[], dateRange: string, moduleName: GoogleReceiptModule) {
  return executionTransaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`search-google:${receipt.auditId}:${receipt.pageUrl}`}, 0))`
    const existing = await tx.auditVerifierExecution.findUnique({
      where: { auditId_targetKey_scopeKey: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}` } }, select: { detail: true },
    })
    const prior = searchReceiptSchema.safeParse(existing?.detail)
    if (prior.success) return prior.data
    if (access && inspection?.indexStatusResult) {
      const status = inspection.indexStatusResult
      await tx.indexStatus.upsert({ where: { auditId_url: { auditId: receipt.auditId, url: receipt.pageUrl } },
        create: { auditId: receipt.auditId, url: receipt.pageUrl, userId: access.legacyUserId,
          verdict: status.verdict ?? 'VERDICT_UNSPECIFIED', coverageState: status.coverageState ?? '',
          robotsTxtState: status.robotsTxtState ?? '', indexingState: status.indexingState ?? '',
          lastCrawlTime: status.lastCrawlTime ? new Date(status.lastCrawlTime) : null,
          googleCanonical: status.googleCanonical ?? null, userCanonical: status.userCanonical ?? null,
          crawledAs: status.crawledAs ?? null, sitemap: status.sitemap ?? [],
          richResults: inspection.richResultsResult as Prisma.InputJsonValue | undefined },
        update: {} })
    }
    if (access && rows.length) await tx.searchPerformance.createMany({ data: rows.map(row => ({
      auditId: receipt.auditId, url: receipt.pageUrl, userId: access.legacyUserId, query: row.keys[0] ?? '',
      clicks: Math.round(row.clicks), impressions: Math.round(row.impressions), ctr: row.ctr, position: row.position,
      device: row.keys[2] ?? '', country: row.keys[3] ?? '', dateRange,
    })) })
    await tx.auditVerifierExecution.upsert({
      where: { auditId_targetKey_scopeKey: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}` } },
      create: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}`, pageUrl: receipt.pageUrl,
        source: 'GOOGLE', status: 'COMPLETED', detail: receipt as Prisma.InputJsonValue,
        evidenceReference: { auditId: receipt.auditId, pageUrl: receipt.pageUrl, connectionId: access?.connectionId ?? null,
          property: access?.property ?? null, dateRange, inspectionResultLink: inspection?.inspectionResultLink ?? null } },
      update: {},
    })
    return receipt
  })
}

export async function runGoogleSearchForAudit(input: {
  auditId: string; userId?: string | null; pages: Array<{ url: string; local?: SearchReceipt }>; deadline: number;
  sections?: Array<'index' | 'analytics'>; receiptModule?: GoogleReceiptModule; deferTransient?: boolean;
}) {
  const moduleName = input.receiptModule ?? 'search-google'
  const indexRequested = !input.sections || input.sections.includes('index')
  const analyticsRequested = !input.sections || input.sections.includes('analytics')
  let retryAfterMs: number | undefined
  const audit = await prisma.audit.findFirst({
    where: { id: input.auditId, userId: input.userId ?? null },
    select: { id: true, projectId: true, parentId: true, userId: true, project: { select: { userId: true } } },
  })
  if (!audit || audit.userId && audit.project?.userId !== audit.userId) throw new Error('Search execution does not belong to this Site owner')
  const access = audit.projectId && audit.userId ? await googleAccess(audit.projectId, audit.userId) : 'NOT_CONNECTED'
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000), start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10), dateRange = `${startDate}/${endDate}`
  const receipts: SearchReceipt[] = []
  let providerRefusal: Failure | null = null
  for (const page of input.pages.slice(0, 24)) {
    const existing = await prisma.auditVerifierExecution.findUnique({
      where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${page.url}` } }, select: { detail: true },
    })
    const saved = searchReceiptSchema.safeParse(existing?.detail)
    if (saved.success) { receipts.push(saved.data); continue }
    if (existing) throw new Error('Persisted Google Search receipt is incompatible')
    const observations: SearchObservation[] = [], collectedAt = new Date().toISOString()
    let inspection: SearchUrlInspection | null = null, rows: GscSearchRow[] = []
    const refusal: Failure | null = providerRefusal ?? (typeof access === 'string' ? access : !searchPropertyCoversUrl(access.property, page.url) ? 'PROPERTY_MISMATCH'
      : input.deadline - Date.now() < 1000 ? 'DEADLINE_EXHAUSTED' : null)
    if (refusal) observations.push(failed(page.url, refusal, 'google-index', collectedAt), failed(page.url, refusal, 'google-analytics', collectedAt))
    else if (typeof access !== 'string') {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(10_000, input.deadline - Date.now())))
      const [index, performance] = await Promise.allSettled([
        indexRequested ? inspectSearchUrl(access.token, access.property, page.url, signal) : Promise.resolve({}),
        analyticsRequested ? querySearchAnalytics(access.token, access.property, startDate, endDate, ['query', 'page', 'device', 'country'], 250, 0, page.url, signal) : Promise.resolve([]),
      ])
      if (indexRequested && index.status === 'fulfilled') {
        inspection = index.value
        const status = inspection.indexStatusResult
        if (!status?.verdict) observations.push(failed(page.url, 'MALFORMED_PROVIDER_RESPONSE', 'google-index', collectedAt))
        else observations.push(providerObservation(page.url, { checkId: 'search-google-index', source: 'google-index', disposition: 'observed',
          reason: 'google_indexed_version_recorded', collectedAt, locator: 'indexStatusResult',
          google: { property: access.property, verdict: status.verdict, lastCrawlAt: status.lastCrawlTime },
          observed: `Google verdict: ${status.verdict}. ${status.coverageState ?? ''} Robots: ${status.robotsTxtState ?? 'not supplied'}. Indexing: ${status.indexingState ?? 'not supplied'}. Last crawl: ${status.lastCrawlTime ?? 'not supplied'}. Google canonical: ${status.googleCanonical ?? 'not supplied'}. Declared canonical: ${status.userCanonical ?? 'not supplied'}.` }))
        if (status?.verdict) {
          const prior = audit.parentId ? await prisma.auditVerifierExecution.findUnique({
            where: { auditId_targetKey_scopeKey: { auditId: audit.parentId, targetKey: `module:${moduleName}`, scopeKey: `page:${page.url}` } },
            select: { detail: true },
          }) : null
          const priorReceipt = searchReceiptSchema.safeParse(prior?.detail)
          const priorIndex = priorReceipt.success ? priorReceipt.data.observations.find(item => item.checkId === 'indexing-failure') : undefined
          const localAllows = page.local?.observations.some(item => item.checkId === 'robots-blocks-indexing' && item.reason === 'no_index_restrictions' && item.disposition === 'passed')
          const sameProperty = priorIndex?.google?.property === access.property
          const newerCrawl = Boolean(status.lastCrawlTime && priorIndex?.google?.lastCrawlAt &&
            new Date(status.lastCrawlTime) > new Date(priorIndex.google.lastCrawlAt))
          const failure = status.verdict === 'FAIL' && localAllows && sameProperty &&
            (priorIndex?.disposition === 'passed' && newerCrawl || priorIndex?.attention.kind === 'flag')
          observations.push(providerObservation(page.url, { checkId: 'indexing-failure', source: 'google-index',
            disposition: status.verdict === 'PASS' ? 'passed' : status.verdict === 'FAIL' ? 'failed' : 'unknown',
            reason: failure ? 'google_indexing_regression' : 'google_indexed_version_assessment',
            attention: failure ? 'flag' : 'observation', collectedAt, locator: 'indexStatusResult',
            google: { property: access.property, verdict: status.verdict, lastCrawlAt: status.lastCrawlTime },
            observed: `Google’s indexed-version verdict is ${status.verdict}; last crawl ${status.lastCrawlTime ?? 'unknown'}.` }))
        }
        if (inspection.richResultsResult) observations.push(providerObservation(page.url, {
          checkId: 'search-google-rich-results', source: 'google-index', disposition: 'observed', reason: 'google_rich_results_recorded', collectedAt,
          locator: 'richResultsResult', google: { property: access.property, lastCrawlAt: status?.lastCrawlTime },
          observed: `Rich-results verdict: ${inspection.richResultsResult.verdict ?? 'not supplied'}. Types: ${inspection.richResultsResult.detectedItems?.map(item => item.richResultType ?? 'unspecified').join(', ') || 'none reported'}.` }))
      } else if (indexRequested && index.status === 'rejected') observations.push(failed(page.url, failureCode(index.reason), 'google-index', collectedAt))
      if (analyticsRequested && performance.status === 'fulfilled') {
        rows = performance.value.filter(row => row.keys[1] === page.url)
        if (rows.length !== performance.value.length) {
          observations.push(failed(page.url, 'MALFORMED_PROVIDER_RESPONSE', 'google-analytics', collectedAt))
          rows = []
        } else {
        observations.push(providerObservation(page.url, { checkId: 'search-google-performance', source: 'google-analytics', disposition: 'observed',
          reason: 'bounded_search_rows_recorded', collectedAt, locator: 'Search Analytics, exact page filter',
          google: { property: access.property, dateRange },
          observed: `${rows.length} query rows recorded for ${dateRange}. The API returns a bounded sample; empty rows do not prove zero traffic.` }))
        const opportunity = rows.filter(row => row.impressions >= 100 && row.position < 10 && row.ctr < 0.02).sort((a, b) => b.impressions - a.impressions)[0]
        if (opportunity) observations.push(providerObservation(page.url, { checkId: 'low-ctr', source: 'google-analytics', disposition: 'observed',
          reason: 'query_ctr_opportunity', attention: 'recommendation', collectedAt, locator: 'Search Analytics query row',
          google: { property: access.property, dateRange },
          observed: `Query "${opportunity.keys[0]}": ${opportunity.impressions} impressions, ${opportunity.clicks} clicks, ${(opportunity.ctr * 100).toFixed(1)}% CTR, position ${opportunity.position.toFixed(1)}. Window: ${dateRange}.` }))
        }
      } else if (analyticsRequested && performance.status === 'rejected') observations.push(failed(page.url, failureCode(performance.reason), 'google-analytics', collectedAt))
      for (const settled of [index, performance]) if (settled.status === 'rejected' && settled.reason instanceof SearchConsoleError)
        retryAfterMs = Math.max(retryAfterMs ?? 0, settled.reason.retryAfterMs ?? 0)
      const failedAccess = [...(index.status === 'rejected' ? [failureCode(index.reason)] : []), ...(performance.status === 'rejected' ? [failureCode(performance.reason)] : [])]
      providerRefusal = failedAccess.find(code => ['AUTH_EXPIRED', 'PERMISSION_REFUSED', 'PROVIDER_QUOTA', 'PROVIDER_UNAVAILABLE'].includes(code)) ?? null
      const connectionId = access.connectionId
      if (connectionId && failedAccess.some(code => code === 'AUTH_EXPIRED' || code === 'PERMISSION_REFUSED')) {
        await executionWrite(tx => tx.siteConnection.update({ where: { id: connectionId }, data: { status: 'NEEDS_REAUTH', statusDetail: C.googleFailures.AUTH_EXPIRED } }))
      }
    }
    const selected = observations.filter(item => item.source === 'google-index' ? indexRequested : analyticsRequested)
    const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: page.url, collectedAt,
      complete: !selected.some(item => item.disposition === 'unknown'), observations: selected })
    if (input.deferTransient && selected.some(item => ['PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA'].includes(item.reason))) {
      receipts.push(receipt)
      continue
    }
    const persisted = await persistGoogle(receipt, typeof access === 'string' ? null : access, inspection, rows, dateRange, moduleName)
    receipts.push(persisted)
    const { recordSearchVerifiers } = await import('./workflow')
    await recordSearchVerifiers(persisted)
  }
  return { receipts, findings: receipts.flatMap(receipt => searchFindings(receipt.observations)), retryAfterMs }
}
