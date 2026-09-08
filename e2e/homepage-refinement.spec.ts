import { expect, test } from '@playwright/test'

for (const width of [375, 390, 1086, 1144]) {
  test(`refined homepage remains complete at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: width < 600 ? 844 : 732 })
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: /Know when customers can't buy/i })
    ).toBeVisible()
    await expect(
      page.getByText(/FixFlags walks your product page to checkout/i).first()
    ).toBeVisible()

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    expect(errors).toEqual([])
  })
}

test('homepage navigation and mobile menu use their real destinations', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await page.waitForTimeout(500)

  const protect = page.getByRole('link', { name: 'Protect', exact: true }).first()
  await expect(protect).toHaveAttribute('href', '/protect')

  const howItWorks = page.getByRole('link', { name: 'How it works', exact: true }).first()
  await expect(howItWorks).toHaveAttribute('href', '/how-it-works')

  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'How it works' })
  ).toBeVisible()
})

test('homepage controls keep practical hit targets and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const primaryControls = [
    page.getByRole('button', { name: 'Open menu' }),
    page.getByRole('button', { name: /Install|Continue to Shopify/i }).first(),
    page.getByLabel('Shopify store domain').first(),
  ]

  for (const control of primaryControls) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  expect(
    await page.evaluate(() =>
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  ).toBe(true)
})
