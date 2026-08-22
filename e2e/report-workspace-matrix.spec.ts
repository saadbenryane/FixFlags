import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const launchWidths = [320, 375, 768, 1280]
test.describe.configure({ timeout: 90_000 })

test('canonical Review shell works at cross-browser launch widths', async ({ browser, browserName, baseURL }) => {
  if (!baseURL) throw new Error('Playwright baseURL is required')
  for (const width of launchWidths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await context.newPage()
    try {
      await page.goto(new URL('/samples?view=report', baseURL).toString())
      await expect(page.locator('[data-workspace-ready="true"]')).toBeVisible({ timeout: 60_000 })

      const scoreHeader = page.locator('#report-status')
      await expect(scoreHeader).toBeVisible()
      await expect(scoreHeader.getByText('Score', { exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Fix list with 7 flags' })).toBeVisible()

      const history = page.getByRole('navigation', { name: 'Review history' }).getByRole('link')
      await expect(history).toHaveCount(2)
      await expect(history.last()).toHaveAttribute('aria-current', 'page')
      const undersizedHistoryTargets = await history.evaluateAll((links) =>
        links
          .map((link) => link.getBoundingClientRect())
          .filter((box) => box.width < 43.99 || box.height < 43.99)
          .map((box) => ({ width: box.width, height: box.height }))
      )
      expect(undersizedHistoryTargets).toEqual([])

      const frameGeometry = await page.locator('[data-report-frame]').evaluate((frame) => {
        const pane = frame.closest('.overflow-y-auto')
        const frameBox = frame.getBoundingClientRect()
        const paneBox = pane?.getBoundingClientRect()
        return {
          frameBottom: frameBox.bottom,
          paneBottom: paneBox?.bottom ?? 0,
          pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      expect(frameGeometry.pageOverflow).toBeLessThanOrEqual(1)
      expect(frameGeometry.frameBottom).toBeLessThanOrEqual(frameGeometry.paneBottom + 2)

      const comparisonFrames = page.locator('[data-comparison-state]')
      expect(await comparisonFrames.count()).toBeGreaterThan(0)
      const externalBorders = await comparisonFrames.evaluateAll((frames) =>
        frames.filter((frame) => !getComputedStyle(frame).boxShadow.includes('inset')).length
      )
      expect(externalBorders).toBe(0)

      if (browserName === 'chromium' && width === 375) {
        const results = await new AxeBuilder({ page: page as never }).analyze()
        expect(results.violations).toEqual([])
      }
    } finally {
      await context.close()
    }
  }
})

test('sample history uses native destinations and browser history', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/samples?view=report')
  await expect(page.locator('[data-workspace-ready="true"]')).toBeVisible({ timeout: 60_000 })
  const history = page.getByRole('navigation', { name: 'Review history' }).getByRole('link')
  await history.first().click()
  await expect(page).toHaveURL(/observation=curated-sample-v0.*view=report/, { timeout: 60_000 })
  await page.goBack()
  await expect(page).toHaveURL(/\/samples\?view=report$/, { timeout: 60_000 })
  await page.goForward()
  await expect(page).toHaveURL(/observation=curated-sample-v0.*view=report/, { timeout: 60_000 })
  await page.getByRole('tab', { name: 'Timeline' }).click()
  await expect(page).toHaveURL(/view=timeline/, { timeout: 60_000 })
  await expect(page.getByRole('slider', { name: 'Scrub through the review path' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/view=report/, { timeout: 60_000 })

  const reportTab = page.getByRole('tab', { name: 'Report', exact: true })
  await reportTab.focus()
  await reportTab.press('ArrowLeft')
  await expect(page).toHaveURL(/view=timeline/, { timeout: 60_000 })
  const timelineTab = page.getByRole('tab', { name: 'Timeline', exact: true })
  await expect(timelineTab).toBeFocused()
  await timelineTab.press('End')
  await expect(page).toHaveURL(/view=report/, { timeout: 60_000 })
})

test('sample route rejects unpublished observations', async ({ page }) => {
  await page.goto('/samples?observation=not-published&view=report')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('#report-status')).toHaveCount(0)
})

test('sample allows replay while chat and Canvas stay locked', async ({ page }) => {
  await page.goto('/samples?view=timeline')
  await expect(page.locator('[data-workspace-ready="true"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByRole('slider', { name: 'Scrub through the review path' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Canvas' })).toHaveCount(0)
  const chat = page.locator('input[aria-label*="Ask about this report"]').first()
  if (!(await chat.isVisible())) await page.getByRole('tab', { name: 'Agent' }).click()
  await expect(chat).toBeDisabled()
})

test('sample shell survives 200% text, dark mode, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 900 })
  await page.goto('/samples?view=report')
  await expect(page.locator('[data-workspace-ready="true"]')).toBeVisible({ timeout: 60_000 })
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
  await expect(page.locator('#report-status')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Review history' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
})
