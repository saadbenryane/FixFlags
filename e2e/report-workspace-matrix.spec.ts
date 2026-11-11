import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { inspectAccessibilityViolations } from './approved-contrast'

const launchWidths = [320, 375, 768, 1280]

test('canonical Site sample works at launch widths', async ({ browser, browserName, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required')
  for (const theme of ['light', 'dark'] as const) for (const width of launchWidths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
    await context.addInitScript(selected => localStorage.setItem('theme', selected), theme)
    const page = await context.newPage()
    try {
      await page.goto(new URL('/how-it-works#sample', baseURL).toString())
      await expect(page.locator('#sample')).toBeVisible()

      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)

      if (browserName === 'chromium' && width === 375) {
        const results = await new AxeBuilder({ page: page as never }).analyze()
        expect((await inspectAccessibilityViolations(page, results.violations)).failures).toEqual([])
      }
    } finally {
      await context.close()
    }
  }
})
