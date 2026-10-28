import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { executionTransaction } from '@/lib/audit/execution-ownership'
import { accessTokenForConnection, googleConnectionGrantScope } from '@/lib/sites/connections/google'
import { searchPropertyCoversUrl } from '@/lib/sites/connections/report-scope'
import { getGscAccess, inspectSearchUrl, querySearchAnalytics, SearchConsoleError, type SearchUrlInspection, type GscSearchRow } from '@/lib/integrations/google-search-console'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import { searchObservationSchema, searchReceiptSchema, type SearchObservation, type SearchReceipt } from './contracts'
import { searchFindings } from './registry'
import { googleIndexObservations } from './google-index'

type Failure = keyof typeof C.googleFailures
type GoogleReceiptModule = 'search-google' | 'search-google-index' | 'search-google-performance'
type GoogleAccess = { token: string; property: string; projectId: string; userId: string } & (
  { connectionId: string; legacyUserId: null; connectionScope: Prisma.SiteConnectionWhereInput } |
  { connectionId: null; legacyUserId: string; legacyScope: Prisma.GscConnectionWhereInput })
type GoogleAdmission = { access: GoogleAccess | Failure; pageUrls: readonly string[]; retryAfterMs?: number }

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

/** Provider rows stay observations. A low click-through rate is a recommendation, not a certified outage. */
export function searchAnalyticsObservations(input: { pageUrl: string; property: string; collectedAt: string; dateRange: string; rows: GscSearchRow[] }): SearchObservation[] {
  const observations = [providerObservation(input.pageUrl, { checkId: 'search-google-performance', source: 'google-analytics', disposition: 'observed',
    reason: 'bounded_search_rows_recorded', collectedAt: input.collectedAt, locator: 'Search Analytics, exact page filter',
    google: { property: input.property, dateRange: input.dateRange },
    observed: `${input.rows.length} query rows recorded for ${input.dateRange}. The API returns a bounded sample; empty rows do not prove zero traffic.` })]
  const opportunity = input.rows.filter(row => row.impressions >= 100 && row.position < 10 && row.ctr < 0.02).sort((a, b) => b.impressions - a.impressions)[0]
  if (opportunity) observations.push(providerObservation(input.pageUrl, { checkId: 'low-ctr', source: 'google-analytics', disposition: 'observed',
    reason: 'query_ctr_opportunity', attention: 'recommendation', collectedAt: input.collectedAt, locator: 'Search Analytics query row',
    google: { property: input.property, dateRange: input.dateRange },
    observed: `Query "${opportunity.keys[0]}": ${opportunity.impressions} impressions, ${opportunity.clicks} clicks, ${(opportunity.ctr * 100).toFixed(1)}% CTR, position ${opportunity.position.toFixed(1)}. Window: ${input.dateRange}.` }))
  return observations
}

function failed(pageUrl: string, failure: Failure, source: 'google-index' | 'google-analytics', collectedAt: string) {
  return providerObservation(pageUrl, { checkId: source === 'google-index' ? 'search-google-index' : 'search-google-performance',
    source, disposition: 'unknown', reason: failure, observed: C.googleFailures[failure], collectedAt, locator: 'provider response' })
}

async function googleAdmission(projectId: string, userId: string, input: {
  pageUrls: readonly string[]; requireConfiguredEvidence?: boolean;
}): Promise<GoogleAdmission | null> {
  const selected = (access: GoogleAccess | Failure): GoogleAdmission => ({ access, pageUrls: input.pageUrls })
  const connection = await prisma.siteConnection.findUnique({ where: { projectId_provider: { projectId, provider: 'SEARCH_CONSOLE' } } })
  if (connection) {
    // A revoked or refused Site connection never falls through to broader legacy credentials.
    if (connection.authorizedByUserId !== userId || connection.status === 'REVOKED') return selected('NOT_CONNECTED')
    if (connection.status === 'MISMATCH' || !connection.propertyId) return selected('PROPERTY_MISMATCH')
    if (!['CONNECTED', 'UNAVAILABLE'].includes(connection.status)) return selected('AUTH_EXPIRED')
    try {
      const token = await accessTokenForConnection(connection, userId)
      return selected(token ? { token, property: connection.propertyId, projectId, userId, connectionId: connection.id, legacyUserId: null,
        connectionScope: { ...googleConnectionGrantScope(connection, userId), projectId, provider: 'SEARCH_CONSOLE', propertyId: connection.propertyId,
          status: { in: ['CONNECTED', 'UNAVAILABLE'] }, project: { userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } } } : 'AUTH_EXPIRED')
    } catch (error) { return { ...selected(failureCode(error)), retryAfterMs: error instanceof SearchConsoleError ? error.retryAfterMs : undefined } }
  }
  const legacy = await prisma.gscConnection.findUnique({ where: { userId }, select: { id: true, siteUrl: true, refreshToken: true } })
  if (!legacy) return null
  // Account-level historical access is enrichment only for the pages it covers.
  // An unrelated Site must not refresh or require that credential.
  const pageUrls = input.requireConfiguredEvidence ? input.pageUrls : input.pageUrls.filter(url => searchPropertyCoversUrl(legacy.siteUrl, url))
  if (!pageUrls.length) return null
  let current
  try { current = await getGscAccess(userId) }
  catch (error) { return { pageUrls, access: failureCode(error), retryAfterMs: error instanceof SearchConsoleError ? error.retryAfterMs : undefined } }
  if (!current) return { pageUrls, access: 'AUTH_EXPIRED' }
  if (current.grant.id !== legacy.id || current.grant.siteUrl !== legacy.siteUrl) return { pageUrls, access: 'AUTHORIZATION_CHANGED' }
  return { pageUrls, access: { token: current.token, property: legacy.siteUrl, projectId, userId, connectionId: null, legacyUserId: userId,
    legacyScope: { id: legacy.id, userId, siteUrl: legacy.siteUrl, refreshToken: current.grant.refreshToken, user: { lifecycleStatus: 'ACTIVE' } } } }
}

/** Refreshing an access token retains the grant. Disconnect, reauthorization,
 * property replacement and Site ownership changes invalidate pending reads. */
async function googleAccessCurrent(access: GoogleAccess, client: Pick<Prisma.TransactionClient, 'siteConnection' | 'gscConnection' | 'project'> = prisma) {
  if (access.connectionId !== null) return Boolean(await client.siteConnection.findFirst({ where: access.connectionScope, select: { id: true } }))
  return Boolean(await client.project.findFirst({ where: { id: access.projectId, userId: access.userId, deletedAt: null,
    user: { lifecycleStatus: 'ACTIVE' } }, select: { id: true } }) &&
    await client.gscConnection.findFirst({ where: access.legacyScope, select: { id: true } }))
}

function failureCode(error: unknown): Failure {
  return error instanceof SearchConsoleError ? error.code : 'PROVIDER_UNAVAILABLE'
}

/** Provider facts and their receipt commit together, with one writer for each Audit/page. */
async function persistGoogle(receipt: SearchReceipt, access: GoogleAccess | null, inspection: SearchUrlInspection | null, rows: GscSearchRow[], dateRange: string, moduleName: GoogleReceiptModule, applicable: boolean) {
  return executionTransaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`search-google:${receipt.auditId}:${receipt.pageUrl}`}, 0))`
    const existing = await tx.auditVerifierExecution.findUnique({
      where: { auditId_targetKey_scopeKey: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}` } }, select: { detail: true },
    })
    const prior = searchReceiptSchema.safeParse(existing?.detail)
    if (prior.success) return prior.data
    if (access) {
      // Keep Project -> connection lock order. Revocation and transfer cannot
      // cross the grant comparison and its evidence commit.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${access.projectId} FOR SHARE`
      if (access.connectionId !== null) await tx.$queryRaw`SELECT id FROM site_connections WHERE id = ${access.connectionId} FOR UPDATE`
      else await tx.$queryRaw`SELECT id FROM "GscConnection" WHERE "userId" = ${access.legacyUserId} FOR SHARE`
      if (!await googleAccessCurrent(access, tx)) {
        receipt = { ...receipt, complete: false, observations: [...new Set(receipt.observations.map(item => item.source))]
          .filter((source): source is 'google-index' | 'google-analytics' => source === 'google-index' || source === 'google-analytics')
          .map(source => failed(receipt.pageUrl, 'AUTHORIZATION_CHANGED', source, receipt.collectedAt)) }
        access = null; inspection = null; rows = []
      } else if (access.connectionId !== null && receipt.observations.some(item => ['AUTH_EXPIRED', 'PERMISSION_REFUSED'].includes(item.reason))) {
        await tx.siteConnection.updateMany({ where: access.connectionScope, data: { status: 'NEEDS_REAUTH', statusDetail: C.googleFailures.AUTH_EXPIRED } })
      }
    }
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
    if (access && rows.length) {
      const userId = access.legacyUserId
      await tx.searchPerformance.createMany({ data: rows.map(row => ({
        auditId: receipt.auditId, url: receipt.pageUrl, userId, query: row.keys[0] ?? '',
        clicks: Math.round(row.clicks), impressions: Math.round(row.impressions), ctr: row.ctr, position: row.position,
        device: row.keys[2] ?? '', country: row.keys[3] ?? '', dateRange,
      })) })
    }
    await tx.auditVerifierExecution.upsert({
      where: { auditId_targetKey_scopeKey: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}` } },
      create: { auditId: receipt.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${receipt.pageUrl}`, pageUrl: receipt.pageUrl,
        source: 'GOOGLE', status: applicable ? 'COMPLETED' : 'NOT_APPLICABLE', detail: receipt as Prisma.InputJsonValue,
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
  requireConfiguredEvidence?: boolean;
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
  const pages = input.pages.slice(0, 24)
  const admission = audit.projectId && audit.userId ? await googleAdmission(audit.projectId, audit.userId,
    { pageUrls: pages.map(page => page.url), requireConfiguredEvidence: input.requireConfiguredEvidence }) : null
  retryAfterMs = admission?.retryAfterMs
  const end = new Date(Date.now() - 24 * 60 * 60 * 1000), start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10), dateRange = `${startDate}/${endDate}`
  const receipts: SearchReceipt[] = []
  let providerRefusal: Failure | null = null
  for (const page of pages) {
    const existing = await prisma.auditVerifierExecution.findUnique({
      where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey: `module:${moduleName}`, scopeKey: `page:${page.url}` } }, select: { detail: true },
    })
    const saved = searchReceiptSchema.safeParse(existing?.detail)
    if (saved.success) { receipts.push(saved.data); continue }
    if (existing) throw new Error('Persisted Google Search receipt is incompatible')
    const observations: SearchObservation[] = [], collectedAt = new Date().toISOString()
    let inspection: SearchUrlInspection | null = null, rows: GscSearchRow[] = []
    const applicable = input.requireConfiguredEvidence === true || admission?.pageUrls.includes(page.url) === true
    const access = applicable ? admission?.access ?? null : null
    if (access && typeof access !== 'string' && !providerRefusal && !await googleAccessCurrent(access)) providerRefusal = 'AUTHORIZATION_CHANGED'
    const refusal: Failure | null = access === null ? 'NOT_CONNECTED' : providerRefusal ?? (typeof access === 'string' ? access : !searchPropertyCoversUrl(access.property, page.url) ? 'PROPERTY_MISMATCH'
      : input.deadline - Date.now() < 1000 ? 'DEADLINE_EXHAUSTED' : null)
    if (refusal) observations.push(failed(page.url, refusal, 'google-index', collectedAt), failed(page.url, refusal, 'google-analytics', collectedAt))
    else if (access && typeof access !== 'string') {
      const signal = AbortSignal.timeout(Math.max(1, Math.min(10_000, input.deadline - Date.now())))
      const [index, performance] = await Promise.allSettled([
        indexRequested ? inspectSearchUrl(access.token, access.property, page.url, signal) : Promise.resolve({}),
        analyticsRequested ? querySearchAnalytics(access.token, access.property, startDate, endDate, ['query', 'page', 'device', 'country'], 250, 0, page.url, signal) : Promise.resolve([]),
      ])
      if (indexRequested && index.status === 'fulfilled') {
        inspection = index.value
        const status = inspection.indexStatusResult
        if (!status?.verdict) observations.push(failed(page.url, 'MALFORMED_PROVIDER_RESPONSE', 'google-index', collectedAt))
        if (status?.verdict) {
          const prior = audit.parentId ? await prisma.auditVerifierExecution.findUnique({
            where: { auditId_targetKey_scopeKey: { auditId: audit.parentId, targetKey: `module:${moduleName}`, scopeKey: `page:${page.url}` } },
            select: { detail: true },
          }) : null
          const priorReceipt = searchReceiptSchema.safeParse(prior?.detail)
          observations.push(...googleIndexObservations({ pageUrl: page.url, property: access.property, collectedAt, status,
            previous: priorReceipt.success ? priorReceipt.data : null, local: page.local }))
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
        observations.push(...searchAnalyticsObservations({ pageUrl: page.url, property: access.property, collectedAt, dateRange, rows }))
        }
      } else if (analyticsRequested && performance.status === 'rejected') observations.push(failed(page.url, failureCode(performance.reason), 'google-analytics', collectedAt))
      for (const settled of [index, performance]) if (settled.status === 'rejected' && settled.reason instanceof SearchConsoleError)
        retryAfterMs = Math.max(retryAfterMs ?? 0, settled.reason.retryAfterMs ?? 0)
      const failedAccess = [...(index.status === 'rejected' ? [failureCode(index.reason)] : []), ...(performance.status === 'rejected' ? [failureCode(performance.reason)] : [])]
      providerRefusal = failedAccess.find(code => ['AUTH_EXPIRED', 'PERMISSION_REFUSED', 'PROVIDER_QUOTA', 'PROVIDER_UNAVAILABLE'].includes(code)) ?? null
    }
    const selected = observations.filter(item => item.source === 'google-index' ? indexRequested : analyticsRequested)
    const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: input.auditId, pageUrl: page.url, collectedAt,
      complete: !selected.some(item => item.disposition === 'unknown'), observations: selected })
    if (input.deferTransient && selected.some(item => ['PROVIDER_UNAVAILABLE', 'PROVIDER_QUOTA'].includes(item.reason))) {
      receipts.push(receipt)
      continue
    }
    // No configured property is optional enrichment. A revoked grant or an
    // explicitly admitted provider diagnostic still owns an unresolved obligation.
    const persisted = await persistGoogle(receipt, typeof access === 'string' ? null : access, inspection, rows, dateRange, moduleName,
      applicable)
    receipts.push(persisted)
    const { recordSearchVerifiers } = await import('./workflow')
    await recordSearchVerifiers(persisted)
  }
  return { receipts, findings: receipts.flatMap(receipt => searchFindings(receipt.observations)), retryAfterMs }
}
