import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { chromium } from 'playwright'

/** Disposable real HTTP/auth/browser proof, not a human usability session. */
async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '')
  assert.equal(database.hostname, 'localhost'); assert.equal(database.port, '55433'); assert.equal(database.pathname, '/search_acceptance')
  const origin = 'http://localhost:3401'
  let protectedPosts = 0
  const fixture = createServer((request, response) => {
    if (request.method === 'POST') { protectedPosts++; response.end('Must not be submitted'); return }
    if (request.url === '/robots.txt') { response.end('User-agent: *\nAllow: /'); return }
    if (request.url === '/sitemap.xml') { response.setHeader('content-type', 'application/xml'); response.end('<urlset></urlset>'); return }
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
      '<body><main><h1>Independent acceptance fixture</h1><p>Real local browser evidence, not a customer website.</p>' +
      '<a href="#details">Inspect details</a><section id="details"><h2>Details</h2><p>This test has a missing page title.</p></section></main>' +
      '<script>fetch("/api/register", {method:"POST"}).catch(function(){})</script></body></html>')
  })
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve))
  const address = fixture.address(); assert(address && typeof address !== 'string')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  let siteId: string | undefined
  try {
    const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { origin }, data: { name: 'Disposable checking acceptance', email: 'progressive-ui-' + randomUUID() + '@example.invalid', password: randomUUID() + randomUUID() },
    })
    assert.equal(signup.status(), 200, 'Disposable sign-up must succeed through the real auth API')
    const account = await signup.json() as { user: { id: string } }
    const me = await context.request.get(origin + '/api/me')
    assert.equal((await me.json()).user?.id, account.user.id, 'The application must recognize the actual session')
    const analysis = await context.request.post(origin + '/api/checks', {
      headers: { origin }, data: { url: 'http://127.0.0.1:' + address.port + '/' },
    })
    assert.equal(analysis.status(), 201, 'Analysis must be admitted through the customer endpoint')
    const admitted = await analysis.json() as { siteId: string; reportId: string }
    assert(admitted.siteId); siteId = admitted.siteId
    const deadline = Date.now() + 120_000
    let publication: { audit: { status: string }; executionProgress?: { total: number }; flags: unknown[] } | null = null
    while (Date.now() < deadline) {
      const response = await context.request.get(origin + '/api/sites/' + siteId)
      assert.equal(response.status(), 200)
      publication = await response.json()
      if (publication!.flags.length && publication!.executionProgress?.total) break
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    assert(publication?.flags.length); assert(publication.executionProgress?.total)
    const page = await context.newPage(), screens: string[] = [], errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(origin + '/sites/' + siteId, { waitUntil: 'domcontentloaded' })
      await page.getByRole('region', { name: 'Checking progress', exact: true }).waitFor()
      await page.getByRole('link', { name: 'Settings', exact: true }).first().waitFor()
      const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
      if (await consent.isVisible()) await consent.click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false,
        'Site overview must reflow at ' + width + 'px')
      const path = '/tmp/fixflags-progressive-site-' + width + '.png'
      await page.screenshot({ path, fullPage: true }); screens.push(path)
    }
    assert.equal(errors.length, 0, errors.join('\n'))
    assert.equal(protectedPosts, 0, 'Public collection must not send registration effects')
    console.log(JSON.stringify({ proof: 'disposable-auth-analysis-progressive-ui', siteId, auditId: admitted.reportId,
      widths: [320, 375, 768, 1280], screenshots: screens, pageErrors: errors.length,
      automaticPublication: true, protectedMutationRequests: protectedPosts,
      limitations: ['No live credentialed provider proof', 'Not observed owner usability or assistive-technology acceptance'] }))
  } finally {
    await browser.close()
    await new Promise<void>(resolve => fixture.close(() => resolve()))
    // Stop the disposable unfinished analysis after the local server closes;
    // never leave Watch enabled or fabricate a website verdict for this fixture.
    if (siteId) {
      const { prisma } = await import('@/lib/db')
      await prisma.audit.updateMany({ where: { projectId: siteId, status: { notIn: ['COMPLETED', 'FAILED'] } },
        data: { status: 'FAILED', completedAt: new Date(), verdict: null, failureCode: 'ACCEPTANCE_FIXTURE_STOPPED',
          errorMsg: 'Disposable UI fixture stopped after progressive-publication checks. Not a website verdict.' } })
      await prisma.$disconnect()
    }
  }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1) })
