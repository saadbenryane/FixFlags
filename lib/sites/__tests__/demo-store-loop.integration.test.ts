import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { startWorker } from '@/lib/queue/worker'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { clearWorkerHeartbeat, touchWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { closeBrowser, getAuditBrowser, getBrowserDiagnostics } from '@/lib/audit/screenshot'
import * as pageSessions from '@/lib/audit/browser/page-session'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { dispatchReadyTasks, reconcileTasks } from '@/lib/audit/progressive/engine'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteBoardFlag, loadSiteHome } from '@/lib/sites/application/queries'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { FLAG_EXPLANATION_FALLBACK } from '@/lib/marketing/copy/flag-explanations'
import { pricingResponse, storefrontContent } from '@/scripts/release-fixture/storefront.mjs'

/**
 * The core loop on the controlled demo store, through the installed worker:
 * add the Site, check it, take the top Flag, copy its fix instructions,
 * repair the store, recheck, and see the same Flag verified.
 */
type StoreConfig = { brokenPricing?: boolean; unlabelledSearch?: boolean }
const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('demo store loop: check, Flag, fix, verify', () => {
  const userId = 'demo-store-loop-' + randomUUID()
  const origin = 'https://example.com'
  const store: StoreConfig = { brokenPricing: true, unlabelledSearch: true }
  let worker: ReturnType<typeof startWorker> | undefined
  const page = (content: string, status = 200) => ({ status, html: '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<title>Trail Supply outdoor equipment</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="description" content="Hiking packs and outdoor equipment from Trail Supply, with clear pricing and checkout.">' +
    '<link rel="icon" href="/favicon.ico"></head><body><main>' + content +
    '<footer><a href="/privacy">Privacy</a><p>Contact: help@example.com</p></footer></main></body></html>' })
  function respond(path: string) {
    if (path === '/robots.txt') return { status: 200, type: 'text/plain', body: `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` }
    if (path === '/sitemap.xml') return { status: 200, type: 'application/xml', body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>` }
    if (path === '/favicon.ico') return { status: 200, type: 'image/x-icon', body: '' }
    const result = path === '/pricing' ? (({ status, content }) => page(content, status))(pricingResponse(store))
      : path === '/checkout' ? page('<h1>Checkout</h1><p>This controlled fixture never places an order.</p>')
        : path === '/privacy' ? page('<h1>Privacy</h1><p>This controlled website stores no customer data.</p>')
          : path === '/signup' || path === '/login' ? page(`<h1>${path === '/signup' ? 'Create account' : 'Log in'}</h1><p>Accounts are not part of this fixture.</p><a href="/">View equipment</a>`)
            : path === '/search' ? page('<h1>Equipment search</h1><p>Trail Pack, $75.</p><a href="/">View equipment</a>')
              : page(storefrontContent(store))
    return { status: result.status, type: 'text/html; charset=utf-8', body: result.html }
  }
  const server = createServer((request, response) => {
    const { status, type, body } = respond(new URL(request.url ?? '/', origin).pathname)
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
    response.end(body)
  })

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const nativeFetch = globalThis.fetch, transport = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubGlobal('fetch', async (input: string | URL | Request, options?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
      if (url.origin !== origin) throw new Error('External transport unavailable in this fixture')
      return nativeFetch(transport + url.pathname + url.search, options)
    })
    const original = pageSessions.createAuditPage
    vi.spyOn(pageSessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async session => {
        await options.configurePage?.(session)
        await session.route('**', async route => {
          const resource = new URL(route.request().url())
          if (resource.origin !== origin) { await route.abort('blockedbyclient'); return }
          const response = await nativeFetch(transport + resource.pathname + resource.search)
          await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() })
        })
      },
    }))
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin', auditsLimit: 100 } })
    await getAuditBrowser(); worker = startWorker(); await worker.waitUntilReady()
    const browser = getBrowserDiagnostics()
    await touchWorkerHeartbeat({ browserOk: browser.connected, activeBrowserContexts: browser.activeContexts })
  })
  afterAll(async () => {
    await worker?.close(); await clearWorkerHeartbeat(); await closeBrowser()
    await prisma.user.deleteMany({ where: { id: userId } })
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(getAuditTaskQueue)]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    vi.restoreAllMocks(); vi.unstubAllGlobals(); await prisma.$disconnect()
  })

  async function complete(auditId: string) {
    await vi.waitFor(async () => {
      // Providers that need credentials stay explicitly incomplete in this fixture.
      await prisma.auditExecutionTask.updateMany({ where: { auditId, workState: { not: 'COMPLETED' },
        workKind: { notIn: ['http', 'browser', 'check', 'finalize', 'search', 'search-resources', 'discovery'] } }, data: { workRecoveryUntil: new Date(0) } })
      await dispatchReadyTasks(await reconcileTasks(auditId))
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ improvementProjectedAt: expect.any(Date) })
    }, { timeout: 90_000, interval: 100 })
  }

  it('verifies the repaired top Flag on the same page', async () => {
    // 1. Add the demo store and check it.
    const source = await createAndEnqueueAudit({ admission: { kind: 'new-check' }, url: origin + '/', userId })
    await complete(source.auditId)
    const siteId = (await prisma.audit.findUniqueOrThrow({ where: { id: source.auditId } })).projectId!
    const site = (await loadSiteRecord(siteId))!

    // 2. The overview leads with the top Flag, in plain words.
    const home = (await loadSiteHome(siteId, { ownerEvidence: true, viewerAuthenticated: true, site }))!
    const titles = home.flags.map(flag => `${flag.checkId}: ${customerFindingLabel(flag)}`)
    console.info('[demo-store-loop] Flags after the first check:\n  ' + titles.join('\n  '))
    expect(home.flags.length).toBeGreaterThan(0)
    const repairs: Record<string, keyof StoreConfig> = {
      'page-http-error': 'brokenPricing', 'broken-internal-links': 'brokenPricing', 'flow-pricing-nav-broken': 'brokenPricing',
      'journey-pricing-evaluation-nav-broken': 'brokenPricing', 'form-inputs-no-label': 'unlabelledSearch', 'buttons-no-text': 'unlabelledSearch',
    }
    // The Flag the overview puts first is the one a person fixes first.
    const top = home.flags[0]
    expect(repairs[top.checkId?.split('::page:')[0] ?? ''], `top Flag ${top.checkId} comes from a controlled defect`).toBeDefined()
    const defect = repairs[top.checkId!.split('::page:')[0]]
    console.info(`[demo-store-loop] Top Flag: ${customerFindingLabel(top)} (${top.checkId})`)

    // 3. The Flag detail explains it and the fix instructions are ready to copy.
    const detail = (await loadSiteBoardFlag(siteId, top.id, site))!
    expect(detail.flag.whyItMatters).toMatch(/^Visitors /)
    expect(detail.flag.whyItMatters).not.toBe(FLAG_EXPLANATION_FALLBACK)
    console.info('[demo-store-loop] Why it matters: ' + detail.flag.whyItMatters)
    const task = await loadSiteFlagCopyTask(site, top.id)
    expect(task.prompt).toContain(origin)
    // The pasted instructions open with the problem in plain words.
    expect(task.prompt.split('\n')[0]).toBe(`Problem to fix on ${top.pageUrl}: ${customerFindingLabel(top)}.`)
    console.info('[demo-store-loop] Fix instructions begin: ' + task.prompt.split('\n')[0])
    await executeSiteCommand({ type: 'RECORD_FIX_HANDOFF', flagId: task.sourceFlagId, userId, builder: 'copy',
      preparedHandoff: { siteId, referenceFlagId: top.id, promptHash: task.promptHash, context: task.revision } })

    // 4. Apply the fix to the store, then check again.
    store[defect] = false
    const fix = await recordSiteFlagFix({ siteId, userId, flagId: top.id, idempotencyKey: 'demo-store-fix',
      changeSummary: 'Applied the copied fix instructions to the demo store' })
    const verification = await executeSiteCommand({ type: 'VERIFY_FLAG', siteId, userId, flagId: top.id,
      attemptId: fix.attemptId, idempotencyKey: 'demo-store-verify' })
    if (!verification.ok || !('verificationAuditId' in verification)) throw new Error('Verification was not admitted')
    await complete(verification.verificationAuditId!)

    // 5. The same Flag is verified with fresh evidence.
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix.attemptId } })
    console.info(`[demo-store-loop] Recheck outcome: ${attempt.outcome} (comparable: ${attempt.comparable})`)
    expect(attempt).toMatchObject({ outcome: 'IMPROVED', comparable: true })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: top.sourceFlagId ?? top.id } })).toMatchObject({ status: 'FIXED' })
    const after = (await loadSiteBoardFlag(siteId, top.id, site))!
    expect(after.flag.status).toBe('FIXED')
    const remaining = (await loadSiteHome(siteId, { ownerEvidence: true, viewerAuthenticated: true, site }))!
    expect(remaining.flags.some(flag => (flag.sourceFlagId ?? flag.id) === (top.sourceFlagId ?? top.id))).toBe(false)
  }, 240_000)
})
