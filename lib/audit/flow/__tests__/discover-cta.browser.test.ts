import type { BrowserContext } from 'playwright'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../../screenshot'
import { collectRenderedActionInventory, discoverFlowCtasWithFallback, rankCtaCandidate } from '../discover-cta'
import { bindAuditPageObservation } from '../../browser/observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { runFlowScan } from '../run-flow-scan'
import { runFlowChecks } from '../../checks/flow'
import { primaryActionAssertions } from '../primary-action-evidence'
import { observeJourneyControls } from '../../journey/discover'
import { observeJourneyPage } from '../../journey/page-observation'
import { runDestinationUXProbes } from '../destination-ux-probes'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native primary action visibility', () => {
  let context: BrowserContext
  afterEach(async () => { await context?.close() })
  afterAll(closeBrowser)
  async function fixture(html: string, targetStatus = 200) {
    const profile = DESKTOP_CAPTURE_PROFILE, url = 'https://example.com/'
    context = await (await getAuditBrowser()).newContext({ viewport: { width: profile.width, height: profile.height }, userAgent: profile.userAgent })
    const page = await context.newPage()
    await page.route('**', route => route.fulfill({ status: route.request().url() === url ? 200 : targetStatus, contentType: 'text/html',
      body: '<!doctype html><html lang="en"><body>' + (route.request().url() === url ? html : '<main><h1>Create your account</h1></main>') + '</body></html>' }))
    await page.goto(url)
    bindAuditPageObservation(page, url, profile, undefined, [])
    return page
  }
  it.each(['opacity:0', 'visibility:hidden', 'content-visibility:hidden'])('does not choose a high-scoring action in an unpainted %s cohort', async style => {
    const page = await fixture('<main><section style="' + style + '"><a id="hidden" href="/pricing">Pricing</a></section>' +
      '<a id="visible" href="/signup">Get started free</a></main>')
    const actions = (await discoverFlowCtasWithFallback(page, page.url())).candidates
    expect(actions.map(action => action.text)).toEqual(['Get started free'])
    expect(rankCtaCandidate(actions)?.href).toBe('https://example.com/signup')
  })
  it('excludes inert actions but retains a visible child override and a disabled primary control', async () => {
    const page = await fixture('<main><section inert><a href="/pricing">Pricing</a></section>' +
      '<section style="visibility:hidden"><a id="visible" style="visibility:visible" href="/signup">Get started free</a></section>' +
      '<button disabled>Start free trial</button></main>')
    expect((await discoverFlowCtasWithFallback(page, page.url())).candidates.map(action => action.text)).toEqual(['Get started free', 'Start free trial'])
  })
  it('clicks the visible primary action and observes its actual destination', async () => {
    const page = await fixture('<main><section style="opacity:0"><a href="/pricing">Pricing</a></section>' +
      '<a id="visible" href="/signup">Get started free</a></main>')
    const result = await runFlowScan(page, 'visible-primary-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8_000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Get started free', finalUrl: 'https://example.com/signup',
      actionEvidence: { candidateCount: 1, clicked: true, navigation: 'changed', response: 'healthy', httpStatus: 200 } })
  })
  it('exercises a visible fragment route action instead of reporting that no primary action exists', async () => {
    const page = await fixture('<main><h1>Choose a useful plan</h1><a href="#/signup">Get started free</a></main>' +
      '<script>addEventListener("hashchange",()=>{if(location.hash==="#/signup")document.querySelector("main").innerHTML="<h1>Create your account</h1><form><label>Email<input type=email></label><button>Continue</button></form>"})</script>')
    const result = await runFlowScan(page, 'fragment-primary-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Get started free', finalUrl: 'https://example.com/#/signup',
      actionEvidence: { candidateCount: 1, clicked: true, navigation: 'changed', responseExpected: false } })
    expect(await page.getByRole('heading', { name: 'Create your account' }).count()).toBe(1)
  })
  it('preserves the bare-placeholder exclusion while using resolved destinations for actual links', async () => {
    const page = await fixture('<main><a href="#">Get started free</a></main>')
    expect((await discoverFlowCtasWithFallback(page, page.url())).candidates).toEqual([])
  })
  it('does not activate embedded credentials or turn their refusal into a missing-action finding', async () => {
    const page = await fixture('<base href="https://fixture-user:PRIVATE_PASSWORD@example.com/signup"><main><a href="#details">Get started free</a></main>')
    const requests: string[] = []
    page.on('request', request => { requests.push(request.url()) })
    const result = await runFlowScan(page, 'credential-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(requests).toEqual([])
    expect(result.actionEvidence).toMatchObject({ candidateCount: 0, candidateComplete: false, clicked: false })
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PASSWORD')
    expect(runFlowChecks(result).some(flag => flag.checkId === 'flow-no-cta-found')).toBe(false)
  })
  it('still exercises an independent public action after refusing a credential-bearing link', async () => {
    const page = await fixture('<base href="https://fixture-user:PRIVATE_PASSWORD@example.com/signup"><main>' +
      '<a href="#details">Get started free</a><a href="https://example.com/signup">Start free trial</a></main>')
    const result = await runFlowScan(page, 'independent-public-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Start free trial', finalUrl: 'https://example.com/signup', actionEvidence: { clicked: true } })
    expect(JSON.stringify(result)).not.toContain('PRIVATE_PASSWORD')
  })
  it.each(['document-base', 'route'])('shares %s declarations with native journey and destination consumers', async kind => {
    const page = await fixture((kind === 'document-base' ? '<base href="/signup">' : '') +
      '<main><h1>Choose a useful plan for your team</h1><p>Review the next step for your account.</p><a href="' +
      (kind === 'document-base' ? '#details' : '#/signup') + '">Get started free</a></main>')
    const controls = await observeJourneyControls(page, new URL(page.url()).origin)
    expect(controls.primaryAction.found).toBe(true)
    expect(controls.links.map(link => link.href)).toEqual(kind === 'document-base' ? ['https://example.com/signup#details'] : [])
    const observed = await observeJourneyPage(page, 'first-visit', 'landing', [], { headline: true, primaryAction: true,
      nextPath: controls.links.length > 0, fieldCount: 0 }, false, { status: 200 }, controls)
    expect(observed).toMatchObject({ actionVersion: 6, pathVersion: 5, primaryAction: true, pathComplete: kind === 'document-base' })
    expect(await runDestinationUXProbes(page, 'Get started free', null)).toMatchObject({ controlsVersion: 3,
      controlsComplete: true, hasPrimaryCTA: true, frictionSignals: { distinctCtaCount: 1 } })
  })
  it('exercises the browser-resolved fragment destination when the document base points elsewhere', async () => {
    const page = await fixture('<base href="/signup"><main><h1>Choose a useful plan</h1><a href="#details">Get started free</a></main>')
    const result = await runFlowScan(page, 'base-primary-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Get started free', finalUrl: 'https://example.com/signup#details',
      actionEvidence: { candidateCount: 1, clicked: true, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 } })
  })
  it('observes a ready rendered client route without requiring an invented HTTP response', async () => {
    const page = await fixture('<main><h1>Plan your next project</h1><a href="#/pricing">Get started free</a></main>' +
      '<script>addEventListener("hashchange",()=>document.querySelector("main").innerHTML="<h1>Plans for your team</h1><p>Choose the plan that fits your project and team.</p><a href=\\"/signup\\">Create your account</a>")</script>')
    const result = await runFlowScan(page, 'content-route-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: 'success', actionEvidence: { clicked: true, navigation: 'changed',
      samePageProgress: 'rendered-route', responseExpected: false, httpStatus: null } })
    expect(primaryActionAssertions(result.actionEvidence).find(assertion => assertion.key === 'primary-action-response'))
      .toMatchObject({ disposition: 'observed' })
  })
  it.each(['url-only', 'loading', 'missing-page', 'cancelled'])('keeps %s fragment-route progress inconclusive after a completed click', async mode => {
    const body = mode === 'loading' ? '<h1>Loading your account</h1><div aria-busy="true">Loading</div><form><input aria-label="Email"><button>Continue</button></form>'
      : mode === 'missing-page' ? '<h1>Page not found</h1><form><button>Return home</button></form>' : ''
    const page = await fixture('<main><h1>Choose a useful plan</h1><a href="#/signup"' + (mode === 'cancelled' ? ' onclick="event.preventDefault()"' : '') + '>Get started free</a></main>' +
      (body ? '<script>addEventListener("hashchange",()=>document.querySelector("main").innerHTML=' + JSON.stringify(body) + ')</script>' : ''))
    const result = await runFlowScan(page, 'unknown-route-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: 'skipped', actionEvidence: { candidateCount: 1, clicked: true, navigation: 'unknown', responseExpected: false } })
    expect(primaryActionAssertions(result.actionEvidence).find(assertion => assertion.key === 'primary-action-navigation'))
      .toMatchObject({ passed: false, complete: false })
    expect(runFlowChecks(result).some(flag => flag.checkId === 'flow-no-cta-found')).toBe(false)
  })
  it('selects and exercises a button named by referenced text without relying on its icon', async () => {
    const page = await fixture('<main><span id="start-label" hidden>Get started free</span>' +
      '<button aria-labelledby="start-label" onclick="location.href=\'/signup\'" style="width:80px;height:44px"><svg aria-hidden="true" width="20" height="20"><path d="M0 10H20"/></svg></button></main>')
    expect(await page.getByRole('button', { name: 'Get started free', exact: true }).count()).toBe(1)
    const result = await runFlowScan(page, 'referenced-primary-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8_000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Get started free', finalUrl: 'https://example.com/signup',
      actionEvidence: { candidateCount: 1, clicked: true, response: 'healthy', httpStatus: 200 } })
  })
  it.each([404, 500, 403, 429])('classifies the actual HTTP %s reached by a native input handler', async status => {
    const page = await fixture('<main><input type="button" value="Get started free" onclick="location.href=\'/signup\'"></main>', status)
    const emitter = page as typeof page & { listenerCount(event: 'response'): number }
    const listenersBefore = emitter.listenerCount('response')
    const result = await runFlowScan(page, 'native-input-response', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: status === 403 || status === 429 ? 'skipped' : 'error_response',
      actionEvidence: { responseExpected: true, httpStatus: status, response: status === 403 || status === 429 ? 'restricted' : 'error' } })
    expect(emitter.listenerCount('response')).toBe(listenersBefore)
  })
  it('resolves referenced labels in order while excluding hidden descendants of visible labels', async () => {
    const page = await fixture('<main><span id="label">Get started<span hidden>Log in</span><span aria-hidden="true">Cancel</span></span>' +
      '<span id="suffix" hidden>free</span><span id="label">Log in</span>' +
      '<button aria-labelledby="missing label suffix" style="width:80px;height:44px"></button></main>')
    expect(await page.getByRole('button', { name: 'Get started free', exact: true }).count()).toBe(1)
    expect((await collectRenderedActionInventory(page)).controls).toEqual([expect.objectContaining({ text: 'Get started free', labelComplete: true })])
  })
  it('retains visible captions and withholds bounded or editable reference evidence', async () => {
    const page = await fixture('<main><span id="other" hidden>Log in</span><button aria-labelledby="other">Get started free</button>' +
      '<span id="long" hidden>' + 'x'.repeat(1001) + '</span><button aria-labelledby="long" style="width:80px;height:44px"></button>' +
      '<textarea id="private">PRIVATE_FIELD_VALUE</textarea><button aria-labelledby="private" style="width:80px;height:44px"></button></main>')
    const inventory = await collectRenderedActionInventory(page)
    expect(inventory.complete).toBe(false)
    expect(inventory.controls.map(control => ({ text: control.text, complete: control.labelComplete })))
      .toEqual([{ text: 'Get started free', complete: true }, { text: '', complete: false }, { text: '', complete: false }])
    expect(JSON.stringify(inventory)).not.toContain('PRIVATE_FIELD_VALUE')
  })
  it('does not collect editable input values as action captions', async () => {
    const page = await fixture('<main><input type="text" role="button" value="PRIVATE_FIELD_VALUE"><input type="password" role="button" value="PRIVATE_PASSWORD"><input type="submit" value="Get started free"></main>')
    const discovered = await discoverFlowCtasWithFallback(page, page.url())
    expect(discovered.candidates.map(candidate => candidate.text)).toEqual(['Get started free'])
    expect(JSON.stringify(discovered)).not.toContain('PRIVATE_')
  })
  it.each(['button', 'submit'])('discovers and activates a native input %s control using its displayed value', async type => {
    const page = await fixture('<main><input id="primary" type="' + type + '" value="Get started free" onclick="location.href=\'/signup\'"></main>')
    expect((await discoverFlowCtasWithFallback(page, page.url())).candidates).toEqual([expect.objectContaining({ text: 'Get started free' })])
    const result = await runFlowScan(page, 'native-input-primary', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8_000 })
    expect(result).toMatchObject({ status: 'success', ctaText: 'Get started free', finalUrl: 'https://example.com/signup',
      actionEvidence: { candidateCount: 1, clicked: true, response: 'healthy', httpStatus: 200 } })
  })
  it('still diagnoses a visible disabled primary action', async () => {
    const page = await fixture('<main><section inert><a href="/pricing">Pricing</a></section><button disabled>Start free trial</button></main>')
    expect(await runFlowScan(page, 'disabled-primary-action', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8_000 }))
      .toMatchObject({ status: 'unclickable', ctaText: 'Start free trial', actionEvidence: { candidateCount: 1, clicked: false, clickBlocked: true } })
  })
  it('falls back to visible navigation when all main actions are unpainted', async () => {
    const page = await fixture('<header><a href="/signup">Get started free</a></header><main><a style="opacity:0" href="/pricing">Pricing</a></main>')
    expect((await discoverFlowCtasWithFallback(page, page.url())).candidates.map(action => action.text)).toEqual(['Get started free'])
  })
  it('scores the rendered label without hidden conversion copy or hidden utility copy', async () => {
    const page = await fixture('<main><a id="terms" href="/terms"><span hidden>Get started free</span>Legal terms</a>' +
      '<a id="start" href="/app"><span style="opacity:0">Log in</span>Get started free</a></main>')
    const actions = (await discoverFlowCtasWithFallback(page, page.url())).candidates
    expect(actions.map(action => action.text)).not.toContain('Get started freeLegal terms')
    expect(rankCtaCandidate(actions)).toMatchObject({ text: 'Get started free', href: 'https://example.com/app' })
  })
  it.each(['controls', 'label'])('does not diagnose a missing action when its %s inventory exceeds the observation bound', async mode => {
    const html = mode === 'controls' ? '<a hidden href="/pricing">Pricing</a>'.repeat(2001) + '<a href="/signup">Get started</a>'
      : '<button>' + 'Get started free '.repeat(100) + '</button>'
    const page = await fixture('<main><h1>Useful planning service for your team</h1>' + html + '</main>')
    const observed = await runFlowScan(page, 'bounded-action', page.url(), { mode: 'primary', captureSteps: false })
    expect(observed.actionEvidence).toMatchObject({ candidateCount: 0, candidateComplete: false })
    expect(runFlowChecks(observed).some(flag => flag.checkId === 'flow-no-cta-found')).toBe(false)
  })
  it('keeps literal IDs distinct from selector syntax when binding original controls', async () => {
    const page = await fixture('<main id="scope"><a id="scope>a:nth-of-type(2)" href="/signup">Get started</a><a href="/signup">Get started</a></main>')
    const observed = await discoverFlowCtasWithFallback(page, page.url())
    expect(observed.candidates).toHaveLength(2)
    expect(new Set(observed.candidates.map(control => control.context)).size).toBe(2)
  })
  it('normalizes rendered label whitespace before scoring and binding the control', async () => {
    const page = await fixture('<main><a href="/app">Get\n   started\t free</a></main>')
    expect(rankCtaCandidate((await discoverFlowCtasWithFallback(page, page.url())).candidates))
      .toMatchObject({ text: 'Get started free', href: 'https://example.com/app' })
  })
})
