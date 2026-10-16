import { createHash, randomUUID } from 'node:crypto'
import type { Page } from 'playwright'
import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { blockFormSubmits } from '../../browser/journey-safety'
import { probeFormValidation } from '../form-probes'
import { checkFormValidation } from '../../checks/form-validation'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native form ownership during empty-field validation', () => {
  afterAll(closeBrowser)
  async function observe(html: string, inspect: (page: Page, token: string) => Promise<void>) {
    const context = await (await getAuditBrowser()).newContext(), token = randomUUID()
    try {
      const page = await context.newPage()
      page.setDefaultTimeout(700)
      let submissions = 0
      await page.route('**', route => {
        if (route.request().url() !== 'https://example.com/form') submissions++
        return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Subscribe</title><main><h1>Subscribe to project updates</h1>' + html + '</main>' })
      })
      await page.goto('https://example.com/form')
      await blockFormSubmits(page, token)
      await inspect(page, token)
      expect(submissions).toBe(0)
    } finally { await context.close() }
  }

  it('recognizes a submit button associated with a form outside its subtree', async () => {
    await observe('<form id="subscribe"><label>Email<input name="email" required></label></form><button form="subscribe">Subscribe</button>', async (page, token) => {
      const result = await probeFormValidation(page, { isolated: true, localValidationToken: token })
      expect(result.evidence).toMatchObject({ disposition: 'passed', reason: 'native_validation' })
      expect(checkFormValidation(result.evidence).flags).toEqual([])
    })
  })

  it('measures local feedback for fields and a submit button owned by an otherwise empty form', async () => {
    await observe('<form id="subscribe"></form><label>Email<input name="email" form="subscribe" aria-required="true" aria-errormessage="email-error"></label>' +
      '<button form="subscribe">Subscribe</button><p id="email-error" hidden></p>' +
      '<script>document.getElementById("subscribe").onsubmit=event=>{event.preventDefault();setTimeout(()=>{const error=document.getElementById("email-error");error.hidden=false;error.textContent="Email is required"},100)}</script>', async (page, token) => {
      const result = await probeFormValidation(page, { isolated: true, localValidationToken: token })
      expect(result.evidence).toMatchObject({ disposition: 'passed', reason: 'client_feedback' })
      expect(result.feedbackMs).toBeGreaterThan(0)
      expect(result.feedbackMs).toBeLessThan(1000)
    })
  })

  it('uses the selected visible submitter instead of an earlier hidden submitter', async () => {
    await observe('<form id="subscribe"><input name="email" aria-required="true"><button hidden>Hidden</button><button id="visible">Subscribe</button><p role="alert" hidden></p></form>' +
      '<script>document.getElementById("subscribe").onsubmit=event=>{event.preventDefault();const error=event.target.querySelector("p");error.hidden=false;error.textContent="Email is required"}</script>', async (page, token) => {
      expect((await probeFormValidation(page, { isolated: true, localValidationToken: token })).evidence).toMatchObject({ disposition: 'passed', reason: 'client_feedback' })
    })
  })

  it('excludes a nested submitter belonging to a different form', async () => {
    await observe('<form id="subscribe"><input name="email" required><button form="other">Other form</button></form><form id="other"></form>', async (page, token) => {
      expect((await probeFormValidation(page, { isolated: true, localValidationToken: token })).evidence).toMatchObject({ disposition: 'failed', reason: 'missing_submit' })
    })
  })

  it('does not claim native rejection when the selected submitter bypasses constraints', async () => {
    await observe('<form id="subscribe"><input name="email" required><button formnovalidate>Subscribe</button></form>' +
      '<script>document.getElementById("subscribe").onsubmit=event=>event.preventDefault()</script>', async (page, token) => {
      expect((await probeFormValidation(page, { isolated: true, localValidationToken: token })).evidence).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
    })
  })

  it('withholds validation for prefilled external fields without retaining their values', async () => {
    await observe('<form id="subscribe"></form><input form="subscribe" name="email" aria-required="true" value="PRIVATE_FORM_VALUE@example.test"><button form="subscribe">Subscribe</button>', async (page, token) => {
      const result = await probeFormValidation(page, { isolated: true, localValidationToken: token })
      expect(result.evidence).toMatchObject({ disposition: 'unknown', reason: 'prefilled_fields' })
      expect(JSON.stringify(result)).not.toContain('PRIVATE_FORM_VALUE')
    })
  })

  it('compares the original owned fields and keeps older subtree-only evidence unverified', async () => {
    await observe('<form id="subscribe"></form><input form="subscribe" name="email" aria-required="true"><button form="subscribe">Subscribe</button><form id="other"></form>' +
      '<script>document.getElementById("subscribe").onsubmit=event=>event.preventDefault()</script>', async (page, token) => {
      const options = { isolated: true, localValidationToken: token }
      const source = (await probeFormValidation(page, options)).evidence!
      expect(source).toMatchObject({ disposition: 'failed', reason: 'missing_feedback' })
      const expectedTargets = [{ context: source.context, selector: source.selector, label: source.label }]
      await page.evaluate(() => { document.querySelector('input')!.required = true })
      expect((await probeFormValidation(page, { ...options, expectedTargets })).evidence).toMatchObject({ context: source.context, disposition: 'passed', reason: 'native_validation' })
      const oldContext = 'form:' + createHash('sha256').update(JSON.stringify([page.url(), JSON.stringify({ form: 'subscribe', action: page.url(), fields: [{ name: 'email', tag: 'INPUT' }] })])).digest('hex')
      expect((await probeFormValidation(page, { ...options, expectedTargets: [{ ...expectedTargets[0], context: oldContext }] })).evidence).toMatchObject({ context: oldContext, disposition: 'unknown', reason: 'form_unavailable' })
      await page.evaluate(() => document.querySelector('input')!.setAttribute('form', 'other'))
      expect((await probeFormValidation(page, { ...options, expectedTargets })).evidence).toMatchObject({ context: source.context, disposition: 'unknown', reason: 'form_unavailable' })
    })
  })
})
