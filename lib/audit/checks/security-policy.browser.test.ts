import { afterAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { securityHeaderObservations } from './security-headers'
import { publicBrowserProxyOptions } from '../browser/public-proxy'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
const scriptHash = createHash('sha256').update('window.allowedByHash=true').digest('base64')
run('native response policy interpretation', () => {
  afterAll(closeBrowser)
  it.each([
    { header: 'cross-origin-opener-policy', value: 'same-origin', parsed: 'SameOriginPlusCoep', isolated: true, complete: true },
    { header: 'cross-origin-opener-policy', value: 'same-origin;report-to="reports"', parsed: 'SameOriginPlusCoep', isolated: true, complete: true },
    { header: 'cross-origin-opener-policy', value: 'same-origin-allow-popups', parsed: 'SameOriginAllowPopups', isolated: false, complete: true },
    { header: 'cross-origin-opener-policy', value: 'noopener-allow-popups', parsed: 'NoopenerAllowPopups', isolated: false, complete: true },
    { header: 'cross-origin-opener-policy', value: 'unsafe-none', parsed: 'UnsafeNone', isolated: false, complete: true },
    { header: 'cross-origin-opener-policy', value: 'unrecognized-policy', parsed: 'UnsafeNone', isolated: false, complete: false },
    { header: 'cross-origin-opener-policy', value: '"same-origin"', parsed: 'UnsafeNone', isolated: false, complete: false },
    { header: 'cross-origin-opener-policy', value: 'SAME-ORIGIN', parsed: 'UnsafeNone', isolated: false, complete: false },
    { header: 'cross-origin-opener-policy', value: 'same-origin, same-origin', parsed: 'UnsafeNone', isolated: false, complete: false },
    { header: 'cross-origin-embedder-policy', value: 'require-corp', parsed: 'RequireCorp', isolated: true, complete: true },
    { header: 'cross-origin-embedder-policy', value: 'credentialless;report-to="reports"', parsed: 'Credentialless', isolated: true, complete: true },
    { header: 'cross-origin-embedder-policy', value: 'unsafe-none', parsed: 'None', isolated: false, complete: true },
    { header: 'cross-origin-embedder-policy', value: 'unrecognized-policy', parsed: 'None', isolated: false, complete: false },
    { header: 'cross-origin-embedder-policy', value: '"require-corp"', parsed: 'None', isolated: false, complete: false },
    { header: 'cross-origin-embedder-policy', value: 'REQUIRE-CORP', parsed: 'None', isolated: false, complete: false },
    { header: 'cross-origin-embedder-policy', value: 'require-corp, require-corp', parsed: 'None', isolated: false, complete: false },
  ])('matches native isolation parsing for $header: $value', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      const headers = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', [scenario.header]: scenario.value }
      await page.route('**', route => route.fulfill({ headers: { 'content-type': 'text/html', ...headers }, body: '<!doctype html><title>Isolation fixture</title>' }))
      await page.goto('https://example.test/')
      expect(await page.evaluate(() => crossOriginIsolated)).toBe(scenario.isolated)
      const protocol = await context.newCDPSession(page)
      const { frameTree } = await protocol.send('Page.getFrameTree')
      const { status } = await protocol.send('Network.getSecurityIsolationStatus', { frameId: frameTree.frame.id })
      const opener = scenario.header === 'cross-origin-opener-policy'
      expect(opener ? status.coop?.value : status.coep?.value).toBe(scenario.parsed)
      await protocol.detach()
      expect(securityHeaderObservations(page.url(), headers).find(item => item.key === (opener ? 'opener-policy' : 'embedder-policy')))
        .toMatchObject({ complete: scenario.complete, passed: scenario.complete })
    } finally { await context.close() }
  })

  it.each([
    { value: 'same-origin', blocked: true, complete: true }, { value: 'same-site', blocked: true, complete: true },
    { value: 'cross-origin', blocked: false, complete: true }, { value: 'unrecognized-policy', blocked: false, complete: false },
    { value: '"same-origin"', blocked: false, complete: false }, { value: 'SAME-ORIGIN', blocked: false, complete: false },
    { value: 'same-origin, same-origin', blocked: false, complete: false },
    { value: 'same-origin;report-to="reports"', blocked: false, complete: false },
  ])('matches actual cross-origin resource delivery for $value', async scenario => {
    const server = createServer((request, response) => {
      if (request.url === '/resource') {
        response.writeHead(200, { 'content-type': 'application/octet-stream', 'cross-origin-resource-policy': scenario.value })
        response.end('fixture')
      } else {
        response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Resource policy fixture</title>')
      }
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const port = (server.address() as { port: number }).port
    const browser = await getAuditBrowser(), context = await browser.newContext({ proxy: publicBrowserProxyOptions(browser, true) })
    try {
      const page = await context.newPage()
      await page.goto(`http://127.0.0.1:${port}/`)
      expect(await page.evaluate(async url => { try { await fetch(url, { mode: 'no-cors' }); return true } catch { return false } }, `http://localhost:${port}/resource`)).toBe(!scenario.blocked)
      expect(securityHeaderObservations(`http://localhost:${port}/resource`, { 'cross-origin-resource-policy': scenario.value }).find(item => item.key === 'resource-policy'))
        .toMatchObject({ complete: scenario.complete, passed: scenario.complete })
    } finally {
      await context.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
  it.each([
    { value: 'camera=*', broad: true, complete: true },
    { value: 'camera=(*)', broad: true, complete: true },
    { value: 'camera=*, camera=()', broad: false, complete: true },
    { value: 'camera=(), camera=*', broad: true, complete: true },
    { value: 'not-camera=*', broad: false, complete: true },
    { value: 'reporting="camera=*"', broad: false, complete: true },
    { value: 'camera=(self "https://trusted.test")', broad: false, complete: true },
    { value: 'camera=*;report-to=default', broad: true, complete: true },
    { value: 'camera = *', broad: false, complete: false },
    { value: 'CAMERA=*', broad: false, complete: false },
    { value: 'camera=*, broken=(', broad: false, complete: false },
    { value: 'microphone=(*)', feature: 'microphone', broad: true, complete: true },
    { value: 'geolocation=(*)', feature: 'geolocation', broad: true, complete: true },
    { value: 'camera=*, unknown=@123', broad: false, complete: false },
    { value: 'camera=*, unknown=%"example"', broad: false, complete: false },
  ])('matches actual permission delegation for $value', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ headers: { 'content-type': 'text/html', 'permissions-policy': scenario.value },
        body: '<!doctype html><title>Permissions fixture</title>' }))
      await page.goto('https://example.test/')
      const delegated = await page.evaluate(feature => {
        const policy = (document as unknown as { featurePolicy: { allowsFeature(feature: string, origin: string): boolean } }).featurePolicy
        return policy.allowsFeature(feature, 'https://foreign.test')
      }, scenario.feature ?? 'camera')
      expect(delegated).toBe(scenario.broad)
      expect(securityHeaderObservations(page.url(), { 'permissions-policy': scenario.value }).find(item => item.key === 'permissions-policy'))
        .toMatchObject({ complete: scenario.complete, passed: scenario.complete && !scenario.broad })
    } finally { await context.close() }
  })
  it.each([
    { value: 'nosniff', blocks: true }, { value: 'NoSnIfF', blocks: true },
    { value: 'nosniff-disabled', blocks: false }, { value: 'other, nosniff', blocks: false },
    { value: 'nosniff, other', blocks: true }, { value: '"nosniff"', blocks: false },
  ])('matches actual MIME protection for $value', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill(new URL(route.request().url()).pathname === '/script.js'
        ? { headers: { 'content-type': 'text/plain', 'x-content-type-options': scenario.value }, body: 'window.mimeScriptRan=true' }
        : { contentType: 'text/html', body: '<!doctype html><title>MIME fixture</title><script src="/script.js"></script>' }))
      await page.goto('https://example.test/')
      expect(await page.evaluate(() => Boolean((window as unknown as { mimeScriptRan?: boolean }).mimeScriptRan))).toBe(!scenario.blocks)
      expect(securityHeaderObservations(page.url(), { 'x-content-type-options': scenario.value })
        .find(item => item.key === 'x-content-type-options')).toMatchObject({ complete: true, passed: scenario.blocks })
    } finally { await context.close() }
  })

  it.each([
    { value: 'unsafe-url, strict-origin-when-cross-origin', referrer: 'https://example.test/', accepted: true },
    { value: 'no-referrer, no-referrer-when-downgrade', referrer: 'https://example.test/private?fixture=private', accepted: false },
    { value: 'origin, unsafe-url', referrer: 'https://example.test/private?fixture=private', accepted: false },
    { value: 'no-referrer, unrecognized', referrer: null, accepted: true },
    { value: 'UNSAFE-URL', referrer: 'https://example.test/private?fixture=private', accepted: false },
    { value: '"unknown, no-referrer, unknown"', referrer: 'https://example.test/', accepted: undefined },
  ])('matches actual referrer disclosure for $value', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      let received: string | null = null
      await page.route('**', async route => {
        if (new URL(route.request().url()).hostname === 'receiver.test') {
          received = await route.request().headerValue('referer')
          await route.fulfill({ status: 204, body: '' })
        } else await route.fulfill({ headers: { 'content-type': 'text/html', 'referrer-policy': scenario.value },
          body: '<!doctype html><title>Referrer fixture</title>' })
      })
      await page.goto('https://example.test/private?fixture=private')
      await page.evaluate(async () => { await fetch('https://receiver.test/', { mode: 'no-cors' }) })
      expect(received).toBe(scenario.referrer)
      expect(securityHeaderObservations(page.url(), { 'referrer-policy': scenario.value })
        .find(item => item.key === 'referrer-policy')).toMatchObject({ complete: scenario.accepted !== undefined, passed: scenario.accepted === true })
    } finally { await context.close() }
  })
  it.each([
    { name: 'WebAssembly permission', csp: "script-src 'self' 'wasm-unsafe-eval'", inline: false, handler: false, eval: false },
    { name: 'nonce compatibility keyword', csp: "script-src 'self' 'unsafe-inline' 'nonce-YWJj'", inline: false, handler: false, eval: false },
    { name: 'hash compatibility keyword', csp: "script-src 'self' 'unsafe-inline' 'sha256-" + scriptHash + "'", inline: false, handler: false, eval: false },
    { name: 'strict dynamic', csp: "script-src 'self' 'unsafe-inline' 'nonce-YWJj' 'strict-dynamic'", inline: false, handler: false, eval: false },
    { name: 'intersecting policies', csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval', script-src 'self'", inline: false, handler: false, eval: false },
    { name: 'first duplicate directive', csp: "script-src 'self' 'unsafe-inline' 'unsafe-eval'; script-src 'self'", inline: true, handler: true, eval: true },
    { name: 'element override', csp: "script-src 'self'; script-src-elem 'self' 'unsafe-inline'; script-src-attr 'none'", inline: true, handler: false, eval: false },
    { name: 'attribute override', csp: "script-src 'self'; script-src-attr 'unsafe-inline'", inline: false, handler: true, eval: false },
    { name: 'restrictive overrides', csp: "script-src 'self' 'unsafe-inline'; script-src-elem 'self'; script-src-attr 'none'", inline: false, handler: false, eval: false },
    { name: 'keyword case', csp: "SCRIPT-SRC 'self' 'UNSAFE-EVAL'", inline: false, handler: false, eval: true },
    { name: 'keyword inside URL', csp: "script-src 'self' https://static.example.test/unsafe-eval", inline: false, handler: false, eval: false },
  ])('$name matches actual inline, handler and JavaScript evaluation behavior', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill(new URL(route.request().url()).pathname === '/bootstrap.js'
        ? { contentType: 'application/javascript', body: 'window.inlineRan=false;window.handlerRan=false;try{window.evalRan=new Function("return true")()}catch{window.evalRan=false}' }
        : { headers: { 'content-type': 'text/html', 'content-security-policy': scenario.csp }, body: '<!doctype html><title>CSP fixture</title>' +
          '<script nonce="YWJj" src="/bootstrap.js"></script><main><h1>Public security fixture</h1><button onclick="window.handlerRan=true">Continue</button></main><script>window.inlineRan=true</script>' }))
      await page.goto('https://example.test/')
      await page.locator('button').click()
      expect(await page.evaluate(() => ({ inline: (window as unknown as { inlineRan: boolean }).inlineRan,
        handler: (window as unknown as { handlerRan: boolean }).handlerRan, eval: (window as unknown as { evalRan: boolean }).evalRan })))
        .toEqual({ inline: scenario.inline, handler: scenario.handler, eval: scenario.eval })
      const observations = securityHeaderObservations(page.url(), { 'content-security-policy': scenario.csp })
      expect(observations.find(item => item.key === 'csp-inline-scripts')).toMatchObject({ complete: true, passed: !scenario.inline && !scenario.handler })
      expect(observations.find(item => item.key === 'csp-eval')).toMatchObject({ complete: true, passed: !scenario.eval })
    } finally { await context.close() }
  })

  it.each([
    { name: 'CSP wildcard overrides DENY', csp: 'frame-ancestors *', xfo: 'DENY', embedded: true },
    { name: 'CSP self restricts foreign parents', csp: "frame-ancestors 'self'", xfo: 'ALLOWALL', embedded: false },
    { name: 'empty ancestor list blocks all parents', csp: 'frame-ancestors', xfo: 'ALLOWALL', embedded: false },
    { name: 'intersecting ancestor policies', csp: "frame-ancestors *, frame-ancestors 'none'", xfo: 'DENY', embedded: false },
  ])('$name matches actual cross-origin embedding', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill(new URL(route.request().url()).hostname === 'parent.test'
        ? { contentType: 'text/html', body: '<!doctype html><script>window.childLoaded=false;addEventListener("message",event=>window.childLoaded=event.data==="loaded")</script><iframe src="https://child.test/"></iframe>' }
        : { headers: { 'content-type': 'text/html', 'content-security-policy': scenario.csp, 'x-frame-options': scenario.xfo },
          body: '<!doctype html><title>Embedded fixture</title><script>parent.postMessage("loaded","*")</script>' }))
      await page.goto('https://parent.test/')
      expect(await page.evaluate(() => (window as unknown as { childLoaded: boolean }).childLoaded)).toBe(scenario.embedded)
      expect(securityHeaderObservations('https://child.test/', { 'content-security-policy': scenario.csp, 'x-frame-options': scenario.xfo })
        .find(item => item.key === 'frame-protection')).toMatchObject({ complete: true, passed: !scenario.embedded })
    } finally { await context.close() }
  })
})
