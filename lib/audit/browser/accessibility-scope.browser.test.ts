import { afterAll, describe, expect, it } from 'vitest'
import AxeBuilder from '@axe-core/playwright'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { ACCESSIBILITY_RUN_OPTIONS } from '../checks/accessibility-rules'
import { recordedAxeViolations, summarizeAccessibility } from './accessibility-evidence'
import { evaluateAccessibility } from '../checks/accessibility-observations'
import { parseMetadataFromHtml } from '../metadata'
import { checkReceiptSchema } from '../checks/receipt'
import { scopedAssertionForTarget } from '../checks/verification'
import { harvestEvidenceOnPage } from '../evidence-targets'
import type { DeterministicFlag } from '../flag-types'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native Accessibility document and shadow scopes', () => {
  const pageUrl = 'https://example.com/'
  afterAll(closeBrowser)
  async function fixture(shadow: boolean, title = true, frameId = 'payment') {
    const context = await (await getAuditBrowser()).newContext()
    const page = await context.newPage()
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: route.request().url().startsWith('https://foreign.example/') ? '<button id=foreign-action></button>' :
      '<!doctype html><html lang="en"><head><title>Account</title></head><body><main><h1>Account</h1>' +
      '<iframe id="' + frameId + '" ' + (title ? 'title="Embedded account"' : '') + ' srcdoc="<button id=inside></button>"></iframe>' +
      '<iframe id="foreign" title="External service" src="https://foreign.example/"></iframe>' +
      (shadow ? '<div id="shadow-host"></div>' : '') + '</main></body></html>' }))
    await page.goto(pageUrl)
    await page.frameLocator('#' + frameId).locator('#inside').waitFor({ state: 'attached' })
    if (shadow) await page.evaluate(() => {
      document.querySelector('#shadow-host')!.attachShadow({ mode: 'open' }).innerHTML = '<button id="shadow-action" style="width:48px;height:48px"></button>'
    })
    return { context, page }
  }
  async function inspect(page: Awaited<ReturnType<typeof fixture>>['page']) {
    const results = await new AxeBuilder({ page }).options(ACCESSIBILITY_RUN_OPTIONS).setLegacyMode(true).analyze()
    const scope = { pageUrl, finalUrl: page.url(), profile: 'controlled-desktop', access: 'public' }
    const checked = evaluateAccessibility({ metadata: parseMetadataFromHtml(await page.content(), pageUrl, 'rendered'),
      evidence: summarizeAccessibility(results, scope), scope, axe: recordedAxeViolations(results) })
    return { results, checked }
  }

  it.each([{ title: true, frameId: 'payment' }, { title: false, frameId: 'iframe' }])('retains first-party frame failures and iframe element responsibility ($frameId)', async ({ title, frameId }) => {
    const { context, page } = await fixture(false, title, frameId)
    try {
      const { results, checked } = await inspect(page)
      const targets = results.violations.find(rule => rule.id === 'button-name')?.nodes.map(node => node.target)
      expect(targets).toEqual([['#' + frameId, '#inside']])
      const failure = checked.flags.find(flag => flag.checkId === 'buttons-no-text')
      expect(failure?.evidenceTargets).toMatchObject([{ selector: '#' + frameId + ' ::frame #inside' }])
      expect(checked.assertions.find(assertion => assertion.key === 'axe:buttons-no-text')).toMatchObject({ passed: false, complete: true })
      expect(checked.flags.some(flag => flag.checkId === 'iframe-no-title')).toBe(!title)
    } finally { await context.close() }
  })

  it.each(['shadow', 'frame'])('independently verifies %s repair and recurrence without borrowing historical proof', async kind => {
    const { context, page } = await fixture(true)
    let original: DeterministicFlag | undefined
    try {
      if (kind === 'shadow') await page.frameLocator('#payment').locator('#inside').evaluate(button => button.setAttribute('aria-label', 'Open payment'))
      else await page.evaluate(() => document.querySelector('#shadow-host')!.shadowRoot!.querySelector('button')!.setAttribute('aria-label', 'Open account'))
      for (const [index, name] of ['', 'Open account', ''].entries()) {
        if (kind === 'frame') await page.frameLocator('#payment').locator('#inside').evaluate((button, name) => {
          if (name) button.setAttribute('aria-label', name)
          else button.removeAttribute('aria-label')
        }, name)
        else await page.evaluate(name => {
          const button = document.querySelector('#shadow-host')!.shadowRoot!.querySelector('button')!
          if (name) button.setAttribute('aria-label', name)
          else button.removeAttribute('aria-label')
        }, name)
        const { results, checked } = await inspect(page)
        const raw = results.violations.find(rule => rule.id === 'button-name')!
        expect(Boolean(raw?.nodes.some(node => node.target.length > 1))).toBe(kind === 'frame' && index !== 1)
        const failure = checked.flags.find(flag => flag.checkId === 'buttons-no-text')
        if (index === 0) original = failure
        expect(original).toBeDefined()
        expect(Boolean(failure)).toBe(index !== 1)
        if (failure) expect(failure.evidenceTargets).toMatchObject([{ selector: kind === 'shadow' ? '#shadow-host >>> #shadow-action' : '#payment ::frame #inside' }])
        if (kind === 'shadow' && index === 0) {
          const harvested = await harvestEvidenceOnPage(page, 'desktop', [['#shadow-host', '#shadow-action']])
          expect(harvested?.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ selector: '#shadow-host >>> #shadow-action' })]))
        }
        const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'accessibility', pageUrl,
          passed: false, applicable: true, complete: checked.complete, assertions: checked.assertions,
          execution: { auditId: 'native-' + index, taskId: 'native-axe', checkVersion: 1,
            source: 'browser-accessibility', collectedAt: new Date().toISOString() } })
        expect(scopedAssertionForTarget({ receipt, checkId: original!.checkId, flag: original! })?.assertion)
          .toMatchObject({ passed: index === 1, complete: true })
        if (index === 1) {
          const historical = { ...original!, evidenceTargets: original!.evidenceTargets!.map(target => ({ ...target,
            context: target.context?.replace(/:same-origin-v2$/, '') })) }
          const saved = structuredClone(historical)
          expect(scopedAssertionForTarget({ receipt, checkId: original!.checkId, flag: historical })).toBeUndefined()
          expect(historical).toEqual(saved)
        }
        if (index === 2) expect(failure!.evidenceTargets).toEqual(original!.evidenceTargets)
      }
    } finally { await context.close() }
  })
})
