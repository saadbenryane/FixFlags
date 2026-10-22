import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { parseMetadataFromHtml } from '../metadata'
import axe from 'axe-core'
import { runAllChecks } from '../checks'
import { healthyDesktopPs } from '../__tests__/check-fixtures'
import { checkReceiptSchema } from '../checks/receipt'
import { scopedAssertionForTarget } from '../checks/verification'
import type { DeterministicFlag } from '../flag-types'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('literal document identifiers in captured metadata', () => {
  afterAll(closeBrowser)
  it.each([
    { name: 'empty explicit label', markup: '<label for="email"></label><input id="email">' },
    { name: 'empty wrapping label', markup: '<label><input id="email"></label>' },
    { name: 'empty hidden label', markup: '<label aria-hidden="true" for="email"></label><input id="email">' },
    { name: 'whitespace ARIA label', markup: '<input id="email" aria-label="   ">' },
    { name: 'missing ARIA reference', markup: '<input id="email" aria-labelledby="missing">' },
    { name: 'empty ARIA reference', markup: '<span id="label"></span><input id="email" aria-labelledby="label">' },
    { name: 'script-only reference', markup: '<span id="label"><script>var labelCopy="Email"</script></span><input aria-labelledby="label">' },
    { name: 'hidden reference descendants', markup: '<span id="label"><span aria-hidden="true">Email</span></span><input aria-labelledby="label">' },
    { name: 'wrapping label for another control', markup: '<button id="other">Continue</button><label for="other">Email<input id="email"></label>' },
    { name: 'hidden label content', markup: '<label><span aria-hidden="true">Email</span><input id="email"></label>' },
    { name: 'empty SVG label content', markup: '<label><svg><title></title></svg><input id="email"></label>' },
    { name: 'textarea contents', markup: '<label><textarea>Existing message</textarea></label>' },
  ])('does not certify a form name from $name', async ({ markup }) => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<!doctype html><html lang="en"><head><title>Signup</title></head><body><main>' + markup + '</main></body></html>')
      expect(await page.getByRole('textbox', { name: '', exact: true }).count()).toBe(1)
      expect(parseMetadataFromHtml(await page.content(), 'https://example.com/', 'rendered').inputsWithoutLabel).toBe(1)
    } finally { await context.close() }
  })
  it.each([
    { name: 'explicit label', markup: '<label for="email">Email</label><input id="email">' },
    { name: 'wrapping label', markup: '<label>Email<input id="email"></label>' },
    { name: 'ARIA label', markup: '<input aria-label="Email">' },
    { name: 'empty reference with another name', markup: '<span id="label"></span><label for="email">Email</label><input id="email" aria-label="Email" aria-labelledby="label">' },
    { name: 'literal hidden reference', markup: '<span hidden id="label">Email</span><input aria-labelledby="label">' },
    { name: 'hidden reference subtree', markup: '<span hidden id="label"><span hidden>Email</span></span><input aria-labelledby="label">' },
    { name: 'hidden explicit label subtree', markup: '<label hidden for="email"><span hidden>Email</span></label><input id="email">' },
    { name: 'ARIA-named reference', markup: '<span id="label" aria-label="Email"></span><input aria-labelledby="label">' },
    { name: 'image-named reference', markup: '<span id="label"><img alt="Email"></span><input aria-labelledby="label">' },
    { name: 'partially missing references', markup: '<span id="label">Email</span><input aria-labelledby="missing label">' },
    { name: 'multiple labels', markup: '<label for="email"></label><label for="email">Email</label><input id="email">' },
    { name: 'named icon label', markup: '<label><svg><title>Email</title></svg><input id="email"></label>' },
  ])('preserves native form names from $name', async ({ markup }) => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main>' + markup + '</main>')
      expect(await page.getByRole('textbox', { name: 'Email', exact: true }).count()).toBe(1)
      expect(parseMetadataFromHtml(await page.content(), 'https://example.com/', 'rendered').inputsWithoutLabel).toBe(0)
    } finally { await context.close() }
  })
  it('keeps nominal label repairs failed, verifies a real name and recognizes recurrence through shared evaluation', async () => {
    const context = await (await getAuditBrowser()).newContext()
    const pageUrl = 'https://example.com/'
    let original: DeterministicFlag | undefined
    try {
      const page = await context.newPage()
      for (const [index, markup] of ['<input id="email">', '<label for="email"></label><input id="email">',
        '<label for="email">Email</label><input id="email">', '<input id="email">'].entries()) {
        await page.setContent('<!doctype html><html lang="en"><head><title>Signup</title></head><body><main><h1>Signup</h1>' + markup + '</main></body></html>')
        await page.addScriptTag({ content: axe.source })
        const violations = await page.evaluate(async () => {
          const engine = (globalThis as unknown as { axe: typeof import('axe-core') }).axe
          return (await engine.run(document, { runOnly: { type: 'rule', values: ['label'] } })).violations.map(rule => rule.id)
        })
        const scope = { pageUrl, finalUrl: page.url(), profile: 'controlled-metadata-browser', access: 'public' }
        const metadata = parseMetadataFromHtml(await page.content(), pageUrl, 'rendered')
        // Native axe above is an independent oracle. The production evaluator
        // deliberately receives only HTML plus a controlled PageSpeed fixture,
        // exercising the fallback when its native rule evidence is unavailable.
        const checked = await runAllChecks(pageUrl, metadata, healthyDesktopPs(), null, [], undefined,
          undefined, undefined, undefined, false, ['accessibility'], { renderedScope: scope })
        const field = checked.flags.find(flag => flag.checkId === 'form-inputs-no-label')
        if (index === 0) original = field
        expect(original).toBeDefined()
        const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, pageUrl,
          ...checked.executions[0], execution: { auditId: 'controlled-' + index, taskId: 'field-names-' + index,
            source: 'browser-accessibility', checkVersion: 1, collectedAt: new Date().toISOString() } })
        expect(receipt.assertions.find(assertion => assertion.key === 'automated-accessibility')?.complete).toBe(false)
        expect(scopedAssertionForTarget({ receipt, checkId: original!.checkId, flag: original! })?.assertion)
          .toMatchObject({ complete: true, passed: index === 2 })
        expect(violations.includes('label')).toBe(index !== 2)
        expect(Boolean(field)).toBe(index !== 2)
        if (index === 3) expect(field?.evidenceTargets).toEqual(original?.evidenceTargets)
      }
    } finally { await context.close() }
  })
  it('keeps a label tied to the first exact ID instead of a later duplicate control', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><span id="field"></span><label for="field">Project name</label><input id="field"></main>')
      expect(await page.getByRole('textbox', { name: 'Project name', exact: true }).count()).toBe(0)
      expect(await page.locator('input').evaluate(element => (element as HTMLInputElement).labels?.length)).toBe(0)
      expect(parseMetadataFromHtml(await page.content(), 'https://example.com/', 'rendered').inputsWithoutLabel).toBe(1)
    } finally { await context.close() }
  })
  it.each([':r0:', 'plan.label', 'field[title]', 'a,b', '0-name', 'quoted"name', 'back\\slash'])
    ('preserves native ARIA and label relationships for %s', async id => {
      const context = await (await getAuditBrowser()).newContext()
      try {
        const page = await context.newPage()
        await page.setContent('<!doctype html><html lang="en"><head><title>Project planning</title></head><body><main></main></body></html>')
        await page.evaluate(id => {
          const heading = document.createElement('span'), button = document.createElement('button'), link = document.createElement('a')
          heading.id = id; heading.textContent = 'Start trial'
          button.setAttribute('aria-labelledby', id)
          link.href = '/start'; link.setAttribute('aria-labelledby', id)
          const field = document.createElement('input'), label = document.createElement('label')
          field.id = id + '-field'; label.htmlFor = field.id; label.textContent = 'Project name'
          document.querySelector('main')!.append(heading, button, link, label, field)
        }, id)
        expect(await page.getByRole('button', { name: 'Start trial', exact: true }).count()).toBe(1)
        expect(await page.getByRole('link', { name: 'Start trial', exact: true }).count()).toBe(1)
        expect(await page.getByRole('textbox', { name: 'Project name', exact: true }).count()).toBe(1)
        expect(parseMetadataFromHtml(await page.content(), 'https://example.com/', 'rendered'))
          .toMatchObject({ title: 'Project planning', buttonsWithoutText: 0, linksWithoutText: 0, inputsWithoutLabel: 0 })
      } finally { await context.close() }
    })
})
