import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { JourneyType } from '../types'

vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: vi.fn(async () => null) }))
vi.mock('@/lib/audit/browser/page-session', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/audit/browser/page-session')>()
  return { ...actual, createAuditPage: (...args: Parameters<typeof actual.createAuditPage>) => {
    if (new URL(args[1]).hostname !== '127.0.0.1') throw new Error('Only the controlled local HTTP fixture is authorized')
    return actual.createAuditPage(args[0], args[1], { ...args[2], allowLocalhost: true })
  } }
})

import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { publicBrowserProxyOptions } from '../../browser/public-proxy'
import { runJourneyTemplate } from '../run-template'
import { journeyAssertions, nativeJourneyFlags } from '../../checks/journey-evidence'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('recorded entry route assessment', () => {
  afterAll(closeBrowser)
  async function walk(journeyType: JourneyType, mode: 'email' | 'no-email' | 'contact-destination' | 'no-links' | 'safety-refusal' | 'button-route') {
    let mutatingRequests = 0
    const server = createServer((request, response) => {
      if (request.method === 'POST') mutatingRequests++
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/contact'
        ? '<main><h1>Office information</h1><p>Read our public information.</p></main>'
        : '<main><h1>Equipment for your next outdoor adventure</h1><button>Add to cart</button>' +
          (['no-links', 'button-route'].includes(mode) ? '' : '<a href="/pricing">Equipment pricing</a><a href="/signup">Create account</a><a href="/login">Log in</a><a href="/privacy">Privacy</a>') +
          (mode === 'email' ? '<p>Contact: verification@fixflags.com</p>' : '') +
          (mode === 'contact-destination' ? '<a href="/contact">Contact us</a>' : '') +
          (mode === 'button-route' ? '<script>document.querySelector("button").onclick=()=>location.href="/pricing"</script>' : '') +
          (mode === 'safety-refusal' ? '<script>fetch("/signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"controlled@example.test",password:"Controlled123!"})})</script>' : '') + '</main>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const startUrl = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
      let workingButtonDestination: string | undefined
      if (mode === 'button-route') {
        const browser = await getAuditBrowser()
        const controlContext = await browser.newContext({ proxy: publicBrowserProxyOptions(browser, true) })
        try {
          const page = await controlContext.newPage()
          await page.goto(startUrl)
          await Promise.all([page.waitForURL(startUrl + 'pricing'), page.getByRole('button', { name: 'Add to cart', exact: true }).click()])
          workingButtonDestination = page.url()
        } finally { await controlContext.close() }
      }
      const result = await runJourneyTemplate(await getAuditBrowser(), { auditId: 'controlled-contact-route', startUrl, journeyType })
      return { ...result, mutatingRequests, workingButtonDestination }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }
  it.each(['email', 'no-email'] as const)('does not call existing navigation a dead end when a contact route is not selected: %s', async mode => {
    const result = await walk('contact-support', mode)
    expect(result).toMatchObject({ status: 'ABANDONED', goalAchieved: false, blockedReason: 'contact_route_not_selected' })
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]!.accessibilityTree).toContain('Equipment pricing')
    expect(result.steps[0]!.accessibilityTree).toContain('Create account')
    if (mode === 'email') expect(result.steps[0]!.accessibilityTree).toContain('verification@fixflags.com')
    expect(result.abandonedReason).toContain('No matching contact or help route')
    expect(result.findings).toEqual([])
    expect(nativeJourneyFlags(result.findings)).toEqual([])
  })
  it('preserves actual protected-action refusal over the missing contact-route reason', async () => {
    const result = await walk('contact-support', 'safety-refusal')
    expect(result).toMatchObject({ status: 'ABANDONED', goalAchieved: false,
      blockedReason: 'protected_action_requires_fixture', mutatingRequests: 0 })
    expect(result.findings).toEqual([])
  })
  it('retains an observed failure after actually opening a contact destination', async () => {
    const result = await walk('contact-support', 'contact-destination')
    expect(result.steps).toHaveLength(2)
    expect(result.findings).toContainEqual(expect.objectContaining({ checkId: 'journey-contact-not-found' }))
    expect(result.goalAchieved).toBe(false)
    expect(result.blockedReason).toBeUndefined()
  })
  it.each(['no-links', 'button-route'] as const)('keeps an unactivated control route incomplete rather than asserting no continuation: %s', async mode => {
    const result = await walk('first-visit', mode)
    expect(result).toMatchObject({ status: 'ABANDONED', goalAchieved: false, blockedReason: 'continuation_route_not_selected' })
    expect(result.findings).toEqual([])
    expect(nativeJourneyFlags(result.findings)).toEqual([])
    const observation = result.pageObservations![0]!
    expect(observation).toMatchObject({ pathVersion: 3, primaryAction: true, nextPath: false, pathComplete: false })
    expect(journeyAssertions(observation).find(assertion => assertion.key === 'landing-path')).toMatchObject({ complete: false, passed: false })
    expect(journeyAssertions(observation).find(assertion => assertion.key === 'landing-headline')).toMatchObject({ complete: true, passed: true })
    expect(journeyAssertions(observation).find(assertion => assertion.key === 'landing-action')).toMatchObject({ complete: true, passed: true })
    if (mode === 'button-route') expect(result.workingButtonDestination).toBe(result.startUrl + 'pricing')
  })
})
