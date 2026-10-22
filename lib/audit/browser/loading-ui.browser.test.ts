import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { loadingUiInDocument, readLoadingUi } from './loading-ui'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native loading visibility inheritance', () => {
  afterAll(closeBrowser)

  it('observes a painted loader whose visibility is restored inside a hidden ancestor', async () => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: 390, height: 800 } })
    try {
      const page = await context.newPage()
      await page.setContent('<!doctype html><html><head><title>Loading visibility</title></head><body>' +
        '<main style="visibility:hidden"><div id="loader" class="spinner" style="visibility:visible;width:300px;height:180px;background:red">Loading content</div></main>' +
        '</body></html>')
      expect(await page.locator('#loader').isVisible()).toBe(true)
      expect(await page.evaluate(() => {
        const box = document.querySelector('#loader')!.getBoundingClientRect()
        return document.elementFromPoint(box.left + 10, box.top + 10)?.id
      })).toBe('loader')
      expect(await readLoadingUi(page)).toMatchObject({ loadingVisible: true, loadingLabel: 'spinner' })
      expect(await page.evaluate(loadingUiInDocument, true)).toBe(false)
      const started = Date.now()
      await page.evaluate(() => { setTimeout(() => document.querySelector('#loader')?.remove(), 150) })
      const cleared = await page.waitForFunction(loadingUiInDocument, true, { timeout: 3000 })
      try { expect(await cleared.jsonValue()).toBeGreaterThanOrEqual(started + 100) }
      finally { await cleared.dispose() }
    } finally { await context.close() }
  })

  it.each(['visibility:hidden', 'display:none', 'opacity:0'])('does not mistake a hidden loader for visible feedback: %s', async hidden => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: 390, height: 800 } })
    try {
      const page = await context.newPage()
      await page.setContent('<!doctype html><html><head><title>Hidden loading</title></head><body>' +
        '<main style="' + hidden + '"><div class="spinner" style="width:300px;height:180px;background:red">Loading content</div></main>' +
        '<h1>Useful page content</h1></body></html>')
      expect(await readLoadingUi(page)).toMatchObject({ loadingVisible: false })
      expect(await page.evaluate(loadingUiInDocument, true)).toEqual(expect.any(Number))
    } finally { await context.close() }
  })

  it.each(['display:none', 'opacity:0'])('a child cannot restore rendering suppressed by ancestor %s', async hidden => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: 390, height: 800 } })
    try {
      const page = await context.newPage()
      await page.setContent('<!doctype html><html><head><title>Hidden loading</title></head><body>' +
        '<main style="' + hidden + '"><div class="spinner" style="visibility:visible;width:300px;height:180px;background:red">Loading content</div></main>' +
        '<h1>Useful page content</h1></body></html>')
      expect(await readLoadingUi(page)).toMatchObject({ loadingVisible: false })
    } finally { await context.close() }
  })
})
