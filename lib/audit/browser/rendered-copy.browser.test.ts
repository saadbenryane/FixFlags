import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { parseMetadataFromHtml } from '../metadata'
import { runSlopChecks } from '../checks/slop'
import { isConsentControl } from '../consent-controls'
import { publicTrustObservations } from '../checks/trust'
import { observeRenderedCopy } from './rendered-copy'
import { runAllChecks } from '../checks'
import { MAX_RAW_TEXT } from '../page-text-limits'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('rendered copy evidence', () => {
  afterAll(closeBrowser)
  it('captures visible introductory paragraphs and stops at the next heading', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><h1>The platform</h1><p>Plan releases <span>for engineering teams.</span></p>' +
        '<p hidden>Hidden audience</p><nav><p>Navigation text</p></nav><h2>Other information</h2><p>Unrelated later audience</p></main>')
      const copy = await observeRenderedCopy(page)
      expect(copy.headlineSupport).toBe('Plan releases for engineering teams.')
      expect(copy.proseBlocks).toContain('Plan releases for engineering teams.')
      expect(copy.proseBlocks).not.toContain('Navigation text')
      expect(copy.proseBlocks).not.toContain('Hidden audience')
    } finally { await context.close() }
  })
  it('separates the headline introduction, visible consent controls, and scoped customer quotes', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<style>.retired{display:none}</style><main><h1>Beautiful digital experiences</h1>' +
        '<p>Developers and code come together on one platform.</p><a href="/work">View case studies</a>' +
        '<figure><blockquote>Great product.</blockquote><figcaption>Alex Smith, CTO at Acme</figcaption></figure>' +
        '<blockquote class="retired">Hidden customer quote.</blockquote><button class="retired">Cookie preferences</button></main>' +
        '<footer>Unrelated biography, CEO at Another Company.</footer><div role="dialog"><p>Cookies and analytics</p><button>Reject analytics cookies</button><button aria-label="Accept analytics cookies">Accept</button></div>')
      const copy = await observeRenderedCopy(page)
      expect(copy.headlineSupport).toBe('Developers and code come together on one platform.')
      expect(copy.testimonialBlocks).toEqual([{ quote: 'Great product.', attribution: 'Alex Smith, CTO at Acme' }])
      expect(copy.consentControlsComplete).toBe(true)
      expect(copy.consentControls?.filter(isConsentControl)).toHaveLength(2)
      expect(copy.consentControls?.filter(isConsentControl).every(control => control.name.includes('analytics cookies'))).toBe(true)
      const metadata = { ...parseMetadataFromHtml(await page.content(), 'https://example.com/'), renderedCopy: copy }
      const checked = await runAllChecks('https://example.com/', metadata, null, null, [], undefined, undefined, undefined, undefined, true, ['messaging-clarity', 'trust-psychology', 'trust'])
      for (const id of ['messaging-no-audience', 'trust-testimonial-quality', 'cookie-consent-absent']) expect(checked.flags.map(flag => flag.checkId)).not.toContain(id)
      await page.locator('[role="dialog"]').evaluate(element => element.remove())
      const withoutControls = await observeRenderedCopy(page)
      expect(withoutControls.consentControls?.filter(isConsentControl)).toEqual([])
      await page.locator('body').evaluate(body => body.insertAdjacentHTML('beforeend', '<div class="cookie-consent"><p>We use cookies.</p><button>Accept all</button><button>Reject all</button></div>'))
      const localContext = await observeRenderedCopy(page)
      expect(localContext.consentControls?.filter(isConsentControl)).toHaveLength(2)
      expect(publicTrustObservations({ ...metadata, hasCookieBasedAnalytics: true, renderedCopy: localContext })['cookie-consent-signals']).toMatchObject({ complete: true, passed: true })
      await page.setContent('<main><blockquote>Great product.</blockquote><section>Other content</section><footer>Alex Smith, CTO at Acme, leads our team.</footer></main>')
      expect((await observeRenderedCopy(page)).testimonialBlocks).toEqual([{ quote: 'Great product.', attribution: null }])
      await page.setContent('<main><div><blockquote>Great product.</blockquote><footer>Alex Smith, CTO at Acme</footer></div></main>')
      expect((await observeRenderedCopy(page)).testimonialBlocks).toEqual([{ quote: 'Great product.', attribution: 'Alex Smith, CTO at Acme' }])
    } finally { await context.close() }
  })
  it('does not report retired CSS-hidden placeholder content as visible page copy', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><title>Team planning</title>' +
        '<style>.retired{display:none}</style></head><body><main><h1>Plan projects for busy teams</h1>' +
        '<p>Organize your work and keep the whole team informed.</p><a href="/start">Get started</a>' +
        '<section class="retired"><h1>Your Company Name</h1><p>Lorem ipsum placeholder text</p></section></main></body></html>' }))
      await page.goto('https://example.com/')
      expect(await page.locator('body').innerText()).not.toContain('Lorem ipsum')
      const metadata = parseMetadataFromHtml(await page.content(), page.url())
      expect(metadata.pageText).toContain('Lorem ipsum')
      const observed = { ...metadata, renderedCopy: await observeRenderedCopy(page) }
      expect(observed.renderedCopy.h1s).toEqual(['Plan projects for busy teams'])
      expect(runSlopChecks(observed).map(flag => flag.checkId)).not.toContain('placeholder-copy-detected')
      const checked = await runAllChecks(page.url(), observed, null, null, [], undefined, null, undefined, undefined, true,
        ['slop', 'content', 'messaging-clarity', 'visual-hierarchy'])
      expect(checked.flags.map(flag => flag.checkId)).not.toContain('template-default-copy')
      await page.locator('.retired').evaluate(element => element.classList.remove('retired'))
      expect(runSlopChecks({ ...metadata, renderedCopy: await observeRenderedCopy(page) }).map(flag => flag.checkId)).toContain('placeholder-copy-detected')
    } finally { await context.close() }
  })

  it('honors actual visibility, visible overrides, display contents and below-fold prose while excluding code', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><section style="visibility:hidden"><h1 style="visibility:visible">Plan projects for your team</h1><p>hidden placeholder</p></section>' +
        '<p style="opacity:0">TODO marker</p><p hidden>TBD marker</p><p style="content-visibility:hidden">Lorem ipsum marker</p>' +
        '<pre>const example = "TODO"</pre><code>undefined</code><section style="display:contents">Visible contents text<h2>Project details</h2></section>' +
        '<p aria-hidden="true">Public interface words</p><p style="margin-top:2000px">More readable project information</p>' +
        '<section hidden>' + 'x'.repeat(1_000_001) + '</section></main>')
      const copy = await observeRenderedCopy(page)
      expect(copy).toMatchObject({ complete: true, h1s: ['Plan projects for your team'], h2s: ['Project details'] })
      expect(copy.pageText).toContain('Visible contents text')
      expect(copy.pageText).toContain('More readable project information')
      expect(copy.pageText).toContain('Public interface words')
      for (const word of ['TODO', 'TBD', 'Lorem ipsum', 'hidden placeholder', 'undefined']) expect(copy.pageText).not.toContain(word)
    } finally { await context.close() }
  })

  it('bounds prose without losing later headings and withholds copy verdicts when the traversal budget is exhausted', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<title>Team planning</title><main><p>' + 'Readable project information. '.repeat(500) + '</p><h1>Plan projects for teams</h1></main>')
      const copy = await observeRenderedCopy(page)
      expect(copy).toMatchObject({ complete: true, textTruncated: true, h1s: ['Plan projects for teams'] })
      expect(copy.pageText).toHaveLength(MAX_RAW_TEXT)
      await page.locator('main').evaluate(element => { element.append(...Array.from({ length: 20_001 }, () => document.createTextNode(' '))) })
      const incomplete = await observeRenderedCopy(page)
      expect(incomplete.complete).toBe(false)
      const metadata = { ...parseMetadataFromHtml(await page.content(), 'https://example.com/'), renderedCopy: incomplete }
      const checked = await runAllChecks('https://example.com/', metadata, null, null, [], undefined, null, undefined, undefined, true, ['slop', 'metadata'])
      expect(checked.executions.find(execution => execution.module === 'slop')).toMatchObject({ complete: false, passed: false })
      expect(checked.executions.find(execution => execution.module === 'metadata')?.failed).not.toBe(true)
    } finally { await context.close() }
  })
})
