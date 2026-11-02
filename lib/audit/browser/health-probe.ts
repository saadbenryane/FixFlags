import type { Browser } from 'playwright'
import { openAuditContext } from './context-lifetime'

/** A local offline render proves Chromium work, never the health of a customer website. */
export async function probeBrowserRendering(browser: Browser, signal?: AbortSignal): Promise<string> {
  const context = await openAuditContext(browser, { offline: true, viewport: { width: 32, height: 32 } },
    { deadline: Date.now() + 10_000, signal, category: 'probe', priority: -1 }, async (context, assertActive) => {
      const page = await context.newPage()
      await page.setContent('<!doctype html><html><body>Ready</body></html>', { timeout: 5000 })
      const png = await page.screenshot({ type: 'png', timeout: 5000 })
      assertActive()
      if (png.length === 0) throw new Error('Browser render probe returned no image')
      return context
    })
  await context.close()
  if (browser.isConnected() && browser.contexts().includes(context)) throw new Error('Browser probe context is still closing')
  return new Date().toISOString()
}
