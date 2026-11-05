import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { auditPageObservation } from '@/lib/audit/browser/observation-scope'
import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks } from '@/lib/audit/checks'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { scopedAssertionForTarget } from '@/lib/audit/checks/verification'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('shared section evaluation against actual redirected browser documents', () => {
  let origin: string, phase = 'broken'
  const requested: string[] = []
  const server = createServer((request, response) => {
    requested.push(request.url!)
    if (request.url === '/start') {
      response.writeHead(302, { location: phase === 'changed' ? '/sections?edition=other' : '/sections?edition=original' })
      response.end(); return
    }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Useful service</title>' +
      (phase === 'foreign-base' ? '<base href="/elsewhere">' : '') + '</head><body><main>' +
      '<h1>Useful service</h1><a href="#contact">Contact</a>' +
      (['repaired', 'changed', 'foreign-base'].includes(phase) ? '<section id="contact">Contact our team</section>' : '') + '</main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    await getAuditBrowser()
  })
  afterAll(async () => {
    await closeBrowser(); server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  })
  async function inspect(next: string) {
    phase = next
    const pageUrl = origin + '/start'
    const session = await createAuditPage(await getAuditBrowser(), pageUrl, {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, deadline: Date.now() + 15_000,
    })
    try {
      const finalUrl = session.page.url(), scope = auditPageObservation(session.page)!.scope
      const metadata = parseMetadataFromHtml(await session.page.content(), finalUrl, 'rendered')
      const evaluate = (url: string) => runAllChecks(url, metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['seo'], { renderedScope: scope })
      const compatibility = await evaluate(pageUrl), progressive = await evaluate(finalUrl)
      expect(compatibility).toEqual(progressive)
      const execution = compatibility.executions[0]
      return { ...compatibility, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', pageUrl,
        applicable: execution.applicable, passed: execution.passed, complete: execution.complete, assertions: execution.assertions,
        execution: { auditId: next, taskId: next, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } }) }
    } finally { session.disposeNetwork(); await session.page.context().close() }
  }
  it('agrees across adapters and requires the original reached document and missing fragment for recovery', async () => {
    const before = await inspect('broken'), flag = before.flags.find(flag => flag.checkId === 'broken-page-anchors')!
    expect(flag).toBeDefined()
    expect(before.receipt).toMatchObject({ complete: true, passed: false })
    const compare = (after: Awaited<ReturnType<typeof inspect>>) => scopedAssertionForTarget({ receipt: after.receipt, checkId: 'broken-page-anchors', flag })
    expect(compare(await inspect('broken'))?.assertion.passed).toBe(false)
    expect(compare(await inspect('changed'))).toBeUndefined()
    expect(compare(await inspect('foreign-base'))).toBeUndefined()
    expect(compare(await inspect('repaired'))?.assertion.passed).toBe(true)
    expect(compare(await inspect('broken'))?.assertion.passed).toBe(false)
    expect(requested).toContain('/start')
    expect(requested).toContain('/sections?edition=original')
    expect(requested).toContain('/sections?edition=other')
  }, 45_000)
})
