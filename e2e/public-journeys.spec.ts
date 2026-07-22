import { expect, test } from '@playwright/test'

const widths = [375, 768, 1280]

test('homepage first-value entry is usable by keyboard', async ({ page }) => {
  await page.goto('/')
  const urlInput = page.getByLabel('Website URL').first()
  await expect(urlInput).toBeVisible()
  await urlInput.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Enter a URL like https://yoursite.com')).toBeVisible()
})

for (const width of widths) {
  test(`homepage has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}

test('auth and pricing entry points render without client errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/pricing')
  await expect(page.getByText('$29')).toBeVisible()
  await expect(page.getByText('$99')).toBeVisible()
  expect(errors).toEqual([])
})

test('anonymous check reaches a completed report and enforces the one-teaser boundary', async ({ page }) => {
  test.skip(process.env.E2E_FULL !== 'true', 'Set E2E_FULL=true for the queue-backed journey')
  test.setTimeout(240_000)

  await page.goto('/')
  await page.getByLabel('Website URL').first().fill('https://example.com')
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await page.waitForURL(/\/report\//, { timeout: 30_000 })
  await expect(page.locator('#report-flags')).toBeVisible({ timeout: 180_000 })

  await page.goto('/')
  await page.getByLabel('Website URL').first().fill('https://www.iana.org')
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await expect(page.getByText(/Create (a free )?account/i).first()).toBeVisible()
})
