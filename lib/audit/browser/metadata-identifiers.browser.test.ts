import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { parseMetadataFromHtml } from '../metadata'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('literal document identifiers in captured metadata', () => {
  afterAll(closeBrowser)
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
