import type { BrowserContext } from 'playwright'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../../screenshot'
import { discoverFlowCtasWithFallback, rankCtaCandidate } from '../discover-cta'
import { bindAuditPageObservation } from '../../browser/observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { runFlowScan } from '../run-flow-scan'
import { runFlowChecks } from '../../checks/flow'

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
  it.each([404, 500, 403, 429])('classifies the actual HTTP %s reached by a native input handler', async status => {
    const page = await fixture('<main><input type="button" value="Get started free" onclick="location.href=\'/signup\'"></main>', status)
    const listenersBefore = page.listenerCount('response')
    const result = await runFlowScan(page, 'native-input-response', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
    expect(result).toMatchObject({ status: status === 403 || status === 429 ? 'skipped' : 'error_response',
      actionEvidence: { responseExpected: true, httpStatus: status, response: status === 403 || status === 429 ? 'restricted' : 'error' } })
    expect(page.listenerCount('response')).toBe(listenersBefore)
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
