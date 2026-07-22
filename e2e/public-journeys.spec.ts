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
