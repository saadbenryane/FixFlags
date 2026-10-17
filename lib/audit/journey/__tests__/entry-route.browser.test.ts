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
import { isCustomerFlag } from '../../attention'
import * as discovery from '../discover'
import { runJourneyTemplate } from '../run-template'
import { journeyAssertions, nativeJourneyFlags } from '../../checks/journey-evidence'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('recorded entry route assessment', () => {
  afterAll(closeBrowser)
  async function walk(journeyType: JourneyType, mode: 'email' | 'no-email' | 'contact-destination' | 'no-links' | 'safety-refusal' | 'button-route' | 'destination-links' | 'oauth-route' | 'inert-signup' | 'no-signup-controls' | 'plain-link' | 'telephone-contact' | 'intentional-revisit') {
    let mutatingRequests = 0
    const server = createServer((request, response) => {
      if (request.method === 'POST') mutatingRequests++
      response.setHeader('content-type', 'text/html')
      response.end(mode === 'plain-link'
        ? '<main><h1>Equipment for outdoor adventures</h1><a href="/equipment">View equipment</a></main>'
        : request.url === '/contact' && mode === 'telephone-contact'
        ? '<main><h1>Speak with our team</h1><a href="tel:+971555555555">Call +971555555555</a></main>'
        : request.url === '/signup' && ['oauth-route', 'inert-signup', 'no-signup-controls'].includes(mode)
        ? '<main><h1>Create your equipment account</h1>' + (mode === 'oauth-route' ? '<button onclick="location.href=\'/authorize\'">Continue with identity provider</button>' : mode === 'inert-signup' ? '<button>Continue with identity provider</button>' : '') + '</main>'
        : request.url === '/authorize'
        ? '<main><h1>Continue registration with your provider</h1></main>'
        : request.url === '/pricing' && mode === 'destination-links'
        ? '<main><h1>Equipment pricing</h1><p>Review equipment pricing and public information.</p><a href="/">View equipment</a><a href="/privacy">Privacy</a><p>Contact: verification@fixflags.com</p></main>'
        : request.url === '/contact'
        ? '<main><h1>Office information</h1><p>Read our public information.</p></main>'
        : '<main><h1>Equipment for your next outdoor adventure</h1><button>Add to cart</button>' +
          (['no-links', 'button-route'].includes(mode) ? '' : '<a href="/pricing">Equipment pricing</a><a href="/signup">Create account</a><a href="/login">Log in</a><a href="/privacy">Privacy</a>') +
          (mode === 'email' ? '<p>Contact: verification@fixflags.com</p>' : '') +
          (['contact-destination', 'telephone-contact'].includes(mode) ? '<a href="/contact">Contact us</a>' : '') +
          (mode === 'button-route' ? '<script>document.querySelector("button").onclick=()=>location.href="/pricing"</script>' : '') +
          (mode === 'safety-refusal' ? '<script>fetch("/signup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"controlled@example.test",password:"Controlled123!"})})</script>' : '') + '</main>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const startUrl = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
      let telephoneHref: string | null = null
      let workingButtonDestination: string | undefined, workingDestinationContinuation: string | undefined, signupControlDestination: string | undefined
      if (['button-route', 'destination-links', 'plain-link'].includes(mode)) {
        const browser = await getAuditBrowser()
        const controlContext = await browser.newContext({ proxy: publicBrowserProxyOptions(browser, true) })
        try {
          const page = await controlContext.newPage()
          await page.goto(mode === 'destination-links' ? startUrl + 'pricing' : startUrl)
          const expectedUrl = mode === 'button-route' ? startUrl + 'pricing' : mode === 'plain-link' ? startUrl + 'equipment' : startUrl
          const action = mode === 'button-route' ? page.getByRole('button', { name: 'Add to cart', exact: true }) : page.getByRole('link', { name: 'View equipment', exact: true })
          await Promise.all([page.waitForURL(expectedUrl), action.click()])
          if (mode === 'button-route') workingButtonDestination = page.url()
          else workingDestinationContinuation = page.url()
        } finally { await controlContext.close() }
      }
      if (['oauth-route', 'inert-signup', 'no-signup-controls'].includes(mode)) {
        const browser = await getAuditBrowser()
        const controlContext = await browser.newContext({ proxy: publicBrowserProxyOptions(browser, true) })
        try {
          const page = await controlContext.newPage()
          await page.goto(startUrl + 'signup')
          const action = page.getByRole('button', { name: 'Continue with identity provider', exact: true })
          if (mode === 'oauth-route') await Promise.all([page.waitForURL(startUrl + 'authorize'), action.click()])
          else if (mode === 'inert-signup') await action.click()
          else expect(await action.count()).toBe(0)
          signupControlDestination = page.url()
        } finally { await controlContext.close() }
      }
      if (mode === 'telephone-contact') {
        const browser = await getAuditBrowser()
        const controlContext = await browser.newContext({ proxy: publicBrowserProxyOptions(browser, true) })
        try {
          const page = await controlContext.newPage()
          await page.goto(startUrl + 'contact')
          telephoneHref = await page.getByRole('link', { name: 'Call +971555555555' }).getAttribute('href')
        } finally { await controlContext.close() }
      }
      const result = await runJourneyTemplate(await getAuditBrowser(), { auditId: 'controlled-contact-route', startUrl, journeyType,
        plan: mode === 'intentional-revisit' ? { goal: 'Intentionally compare repeated public routes', confidence: 1, estimatedDurationMs: 10000,
          steps: ['/', '/pricing', '/', '/pricing', '/'].map((target, index) => ({ stepNumber: index + 1, action: 'navigate' as const, target, expectedResult: 'Revisit the chosen public page', evidence: [] })) } : null })
      return { ...result, mutatingRequests, workingButtonDestination, workingDestinationContinuation, signupControlDestination, telephoneHref }
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
  it('retains an advisory observation after actually opening a contact destination', async () => {
    const result = await walk('contact-support', 'contact-destination')
    expect(result.steps).toHaveLength(2)
    expect(result.findings).toContainEqual(expect.objectContaining({ checkId: 'journey-contact-not-found' }))
    expect(isCustomerFlag(result.findings.find(item => item.checkId === 'journey-contact-not-found')!)).toBe(false)
    expect(result.goalAchieved).toBe(false)
    expect(result.blockedReason).toBeUndefined()
  })
  it.each(['first-visit', 'pricing-evaluation'] as const)('keeps an unrecognized destination primary action advisory when navigation works: %s', async journeyType => {
    const result = await walk(journeyType, 'destination-links')
    expect(result.steps).toHaveLength(2)
    expect(result.steps[1]!.accessibilityTree).toContain('View equipment')
    expect(result.workingDestinationContinuation).toBe(result.startUrl)
    expect(result.mutatingRequests).toBe(0)
    const observation = result.findings.find(item => item.checkId === `journey-${journeyType}-destination-no-next-action`)!
    expect(observation).toMatchObject({ source: 'JOURNEY', severity: 'IMPORTANT' })
    expect(isCustomerFlag(observation)).toBe(false)
    expect(observation.problem).toBe("Review the destination's primary action")
    expect(observation.evidence).toContain('no recognized primary CTA was detected')
    expect(observation.whyItMatters).not.toMatch(/dead.end|conversion|revenue|abandon/i)
    expect(observation.fix).toContain('If a primary action is needed')
  })
  it('does not call a working unrecognized plain link a hidden action failure', async () => {
    const result = await walk('first-visit', 'plain-link')
    expect(result.workingDestinationContinuation).toBe(result.startUrl + 'equipment')
    expect(result.steps[0]?.accessibilityTree).toContain('View equipment')
    expect(result.mutatingRequests).toBe(0)
    const finding = result.findings.find(item => item.checkId === 'journey-first-visit-hidden-cta')!
    expect(finding).toBeDefined()
    expect(isCustomerFlag(finding)).toBe(false)
    expect(finding.problem).toBe("Review the entry page's primary action")
    expect(finding.fix).toContain('If a primary action is needed')
  })
  it('does not infer unusable help from unrecognized contact wording', async () => {
    const result = await walk('contact-support', 'telephone-contact')
    expect(result.steps[1]?.accessibilityTree).toContain('Call +971555555555')
    expect(result.telephoneHref).toBe('tel:+971555555555')
    expect(result.mutatingRequests).toBe(0)
    const finding = result.findings.find(item => item.checkId === 'journey-contact-not-found')!
    expect(finding).toBeDefined()
    expect(isCustomerFlag(finding)).toBe(false)
    expect(finding.problem).toBe('Review the contact mechanism')
    expect(finding.fix).toContain('If the intended contact mechanism is unavailable')
    // A rendered telephone link does not prove an answered call or completed support request.
  })
  it('does not call intentional planned URL revisits a trapped visitor', async () => {
    const result = await walk('multi-step-funnel', 'intentional-revisit')
    const finding = result.findings.find(item => item.checkId === 'journey-funnel-loop-detected')!
    expect(finding).toBeDefined()
    expect(result.steps.filter(step => step.url === finding.url)).toHaveLength(3)
    expect(result.mutatingRequests).toBe(0)
    expect(isCustomerFlag(finding)).toBe(false)
    expect(finding.problem).toBe('Review the repeated navigation')
    expect(finding.whyItMatters).not.toMatch(/traps|confusing|broken routing/i)
  })
  it.each(['oauth-route', 'inert-signup', 'no-signup-controls'] as const)('does not infer failed registration from zero editable fields: %s', async mode => {
    const result = await walk('signup', mode)
    const observation = result.pageObservations?.find(item => item.phase === 'destination')
    expect(observation).toMatchObject({ available: true, fieldCount: 0 })
    expect(result.signupControlDestination).toBe(result.startUrl + (mode === 'oauth-route' ? 'authorize' : 'signup'))
    expect(result.mutatingRequests).toBe(0)
    expect(result.goalAchieved).toBe(false)
    const finding = result.findings.find(item => item.checkId === 'journey-signup-no-form')!
    expect(finding).toBeDefined()
    expect(isCustomerFlag(finding)).toBe(false)
    expect(finding.problem).toBe('Review the signup mechanism')
    expect(finding.evidence).toContain('No visible editable fields were recorded')
    expect(finding.whyItMatters).not.toMatch(/abandon|revenue|conversion|cannot continue/i)
    expect(finding.fix).toContain('If the intended mechanism is unavailable')
    // The separate GET control check proves navigation only, not account creation or provider authentication.
    expect(journeyAssertions(observation!).find(item => item.key === 'destination-form')?.passed).toBe(false)
  })
  it('does not turn an incomplete entry control inventory into absence guidance', async () => {
    const original = discovery.observeJourneyControls
    const inventory = vi.spyOn(discovery, 'observeJourneyControls').mockImplementation(async (...args) => {
      const observation = await original(...args)
      return { ...observation, primaryAction: { ...observation.primaryAction, complete: false } }
    })
    try {
      const result = await walk('first-visit', 'plain-link')
      expect(result.steps[0]?.accessibilityTree).toContain('View equipment')
      expect(result.pageObservations?.[0]).toMatchObject({ available: true, actionComplete: false })
      expect(result.findings.some(item => item.checkId === 'journey-first-visit-hidden-cta')).toBe(false)
      expect(result.goalAchieved).toBe(false)
    } finally { inventory.mockRestore() }
  })
  it('does not turn an incomplete destination control inventory into an absence recommendation', async () => {
    const original = discovery.observeJourneyControls
    const inventory = vi.spyOn(discovery, 'observeJourneyControls').mockImplementation(async (...args) => {
      const observation = await original(...args)
      return observation.pageUrl.endsWith('/pricing')
        ? { ...observation, primaryAction: { ...observation.primaryAction, complete: false } }
        : observation
    })
    try {
      const result = await walk('first-visit', 'destination-links')
      expect(result.steps).toHaveLength(2)
      expect(result.pageObservations?.find(item => item.phase === 'destination')).toMatchObject({ available: true, actionComplete: false })
      expect(result.findings.some(item => item.checkId === 'journey-first-visit-destination-no-next-action')).toBe(false)
      expect(result.goalAchieved).toBe(false)
    } finally { inventory.mockRestore() }
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
