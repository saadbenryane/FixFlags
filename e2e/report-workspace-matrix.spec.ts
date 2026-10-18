import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { inspectAccessibilityViolations } from './approved-contrast'

const launchWidths = [320, 375, 768, 1280]

test('canonical Site sample works at launch widths', async ({ browser, browserName, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required')
  for (const theme of ['light', 'dark'] as const) for (const width of launchWidths) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme })
    await context.addInitScript(selected => localStorage.setItem('theme', selected), theme)
    const page = await context.newPage()
    try {
      await page.goto(new URL('/samples', baseURL).toString())
      await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
      await expect(page.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage.title, exact: true })).toBeVisible()
      for (const section of ['observed', 'fix', 'prompt', 'verification'] as const)
        await expect(page.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage[section], exact: true })).toBeVisible()

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

test('sample preserves a published observation and rejects an unknown one', async ({ page }) => {
  await page.goto('/samples')
  const observation = await page.locator('[data-testid="sample-site"]').getAttribute('data-observation')
  expect(observation).toBeTruthy()

  await page.goto(`/samples?observation=${encodeURIComponent(observation!)}`)
  await expect(page.locator('[data-testid="sample-site"]')).toHaveAttribute('data-observation', observation!)

  await page.goto('/samples?observation=not-published')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})
