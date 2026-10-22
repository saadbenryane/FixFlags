import { afterAll, describe, expect, it } from 'vitest'
import type { Route } from 'playwright'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { captureScreenshot } from './capture-screenshot'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native screenshot operation deadline', () => {
  afterAll(closeBrowser)
  it('times out waiting for fonts while preserving real page interaction and later capture', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      const pending: Route[] = []
      await page.route('**/*', route => route.request().url().endsWith('/pending.woff2') ? void pending.push(route) : route.fulfill({
        contentType: 'text/html', body: '<style>@font-face{font-family:Pending;src:url("/pending.woff2")}body{font-family:Pending}</style><h1>Public equipment catalog</h1><button onclick="this.textContent=\'Selected\'">Select equipment</button>',
      }))
      await page.goto('https://screenshot.example.test/', { waitUntil: 'domcontentloaded' })
      await page.evaluate(() => { void document.fonts.load('16px Pending') })
      expect(await page.evaluate(() => document.fonts.status)).toBe('loading')
      await expect(captureScreenshot(page, { type: 'png', timeout: 200 }, Date.now() + 5000)).rejects.toThrow(/Timeout.*exceeded/)
      expect(page.isClosed()).toBe(false)
      await page.getByRole('button', { name: 'Select equipment' }).click({ timeout: 1000 })
      expect(await page.getByRole('button').textContent()).toBe('Selected')
      await page.addStyleTag({ content: 'body { font-family: sans-serif }' })
      // Abort the outstanding font request before recording real healthy pixels.
      expect(pending).toHaveLength(1)
      await pending[0].abort()
      const image = await captureScreenshot(page, { type: 'png' }, Date.now() + 5000)
      expect(image.subarray(1, 4).toString()).toBe('PNG')
    } finally { await context.close() }
  })
})
