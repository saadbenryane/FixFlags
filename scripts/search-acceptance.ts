import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { prisma } from '@/lib/db'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { runSearchWorkflow, recordSearchVerifiers } from '@/lib/audit/search/workflow'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { projectCheckResults } from '@/lib/sites/check-results'
import { searchVerifierSchema } from '@/lib/audit/search/contracts'
import type { SiteRecord } from '@/lib/sites/types'

/** Explicit disposable acceptance database only. Never changes an existing owner database. */
async function main() {
  const dbUrl = new URL(process.env.DATABASE_URL ?? '')
  assert.equal(dbUrl.hostname, 'localhost')
  assert.equal(dbUrl.port, '55433')
  assert.equal(dbUrl.pathname, '/search_acceptance')
  process.env.DEV_ALLOW_LOCALHOST = 'true'
  let broken = false
  const server = createServer((request, response) => {
    if (request.url === '/robots.txt') { response.setHeader('Content-Type', 'text/plain'); response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') {
      response.setHeader('Content-Type', 'application/xml')
      response.end('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'); return
    }
    response.setHeader('Content-Type', 'text/html')
    response.end('<!doctype html><html lang="en"><head>' + (broken ? '' : '<title>Search acceptance</title>') +
      '</head><body><h1>Search acceptance</h1><script>const s=document.createElement("script");s.type="application/ld+json";s.text=JSON.stringify({"@context":"https://schema.org","@type":"WebSite",name:"Search acceptance",url:location.href});document.head.append(s)</script></body></html>')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  const url = 'http://127.0.0.1:' + address.port + '/'
  const browser = await chromium.launch({ headless: true })
  const prefix = 'search-acceptance-' + Date.now()
  const owner = await prisma.user.create({ data: { email: prefix + '@example.invalid' } })
  const site = await prisma.project.create({ data: { userId: owner.id, url, canonicalHost: '127.0.0.1', name: 'Disposable Search acceptance' } })
  async function execute(parentId?: string) {
    const audit = await prisma.audit.create({ data: { url, projectId: site.id, userId: owner.id, parentId,
      status: 'COMPLETED', reportCompleteness: 'PARTIAL', completedAt: new Date() } })
    const session = await createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE,
      allowLocalhost: true, collectSearchEvidence: true, settle: false, deadline: Date.now() + 20_000 })
    try {
      const result = await runSearchWorkflow({ auditId: audit.id, pageUrl: url, original: session.originalDocument,
        renderedHtml: await session.page.content(), headers: session.responseHeaders, status: session.httpStatus,
        finalUrl: session.page.url(), deadline: Date.now() + 20_000, cache: new Map() })
      return { audit, ...result }
    } finally { session.disposeNetwork(); await session.page.context().close() }
  }
  try {
    const healthy = await execute()
    assert.equal(healthy.receipt.observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'original-html')?.disposition, 'not_applicable')
    assert.equal(healthy.receipt.observations.find(item => item.checkId === 'search-structured-invalid' && item.source === 'rendered-dom')?.disposition, 'passed')
    broken = true
    const failure = await execute(healthy.audit.id)
    const finding = failure.findings.find(item => item.checkId === 'title-missing')
    assert(finding && finding.attentionPolicy?.kind === 'flag')
    const flag = await prisma.flag.create({ data: { auditId: failure.audit.id, source: 'DETERMINISTIC', rubric: 'REACH',
      impactTag: 'SEO', severity: 'CRITICAL', checkId: finding.checkId, pageUrl: url, problem: finding.problem,
      evidence: finding.evidence, whyItMatters: 'A title identifies the public page.', fix: finding.fix,
      confidence: finding.confidence, position: 0, attentionPolicy: finding.attentionPolicy } })
    const improvement = await prisma.improvement.create({ data: { projectId: site.id, fingerprint: prefix,
      title: finding.problem, judgment: 'Observed missing title', expectedBenefit: 'A useful title', recommendedChange: finding.fix,
      successCondition: 'Fresh public capture records a title',
      occurrences: { create: { flagId: flag.id, auditId: failure.audit.id, kind: 'OBSERVED' } },
      attempts: { create: { sourceAuditId: failure.audit.id, builder: 'acceptance' } } } })
    assert(improvement.id)
    const unrepaired = await execute(failure.audit.id)
    const proof = async (auditId: string) => {
      const ledger = await prisma.auditVerificationReceipt.findFirst({ where: { auditId, targetKey: 'check:title-missing' } })
      return searchVerifierSchema.parse(ledger?.detail)
    }
    assert.equal((await proof(unrepaired.audit.id)).verdict, 'failed')
    broken = false
    const repair = await execute(failure.audit.id)
    assert.equal((await proof(repair.audit.id)).verdict, 'passed')
    await recordSearchVerifiers(repair.receipt)
    assert.equal(await prisma.auditVerificationReceipt.count({ where: { auditId: repair.audit.id, targetKey: 'check:title-missing' } }), 1)
    broken = true
    const recurrence = await execute(repair.audit.id)
    assert.equal(recurrence.findings.find(item => item.checkId === 'title-missing')?.attentionPolicy?.kind, 'flag')
    const resultPage = await loadSiteCheckResultPage({ projectId: site.id } as SiteRecord, recurrence.audit.id)
    assert(resultPage.results.every(item => !item.historical && item.auditId === recurrence.audit.id))
    assert(resultPage.nextCursor)
    const history = await loadSiteCheckResultPage({ projectId: site.id } as SiteRecord, recurrence.audit.id, resultPage.nextCursor)
    assert(history.results.every(item => item.historical && item.auditId !== recurrence.audit.id))
    const ledger = await prisma.auditVerificationReceipt.findMany({ where: { auditId: recurrence.audit.id, targetKey: 'module:search' } })
    assert.deepEqual(resultPage.results, projectCheckResults(recurrence.audit.id, ledger))
    console.log(JSON.stringify({ status: 'passed', database: 'disposable', browser: 'Playwright',
      scenarios: ['original versus injected markup', 'failure', 'unrepaired verification', 'fresh recovery', 'recurrence', 'idempotent proof', 'current/history separation', 'shared projection'],
      executions: 5, auditIds: [healthy, failure, unrepaired, repair, recurrence].map(result => result.audit.id) }))
  } finally {
    await browser.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Search acceptance failed'); process.exitCode = 1 })

