import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const launchWidths = [320, 375, 768, 1280]

test('canonical Site sample works at launch widths', async ({ browser, browserName, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required')
  for (const width of launchWidths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    try {
      await page.goto(new URL('/samples', baseURL).toString())
      await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'One Site, one evidence-backed Flag' })).toBeVisible()
      await expect(page.getByText('Evidence', { exact: true })).toBeVisible()
      await expect(page.getByText('Proposed change', { exact: true })).toBeVisible()
      await expect(page.getByText('Verify succeeds when', { exact: true })).toBeVisible()

      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }))
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)

      if (browserName === 'chromium' && width === 375) {
        const results = await new AxeBuilder({ page: page as never }).analyze()
        expect(results.violations.filter((violation) => violation.id !== 'color-contrast')).toEqual([])
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
