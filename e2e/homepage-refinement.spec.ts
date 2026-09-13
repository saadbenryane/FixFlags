import { expect, test } from '@playwright/test'

for (const width of [375, 390, 1086, 1144]) {
  test(`refined homepage remains complete at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: width < 600 ? 844 : 732 })
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: /Your website,\s*looked after\./i })
    ).toBeVisible()
    await expect(
      page.getByText(/Keep building\. FixFlags monitors your live website/i).first()
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

  const product = page.getByRole('navigation').getByRole('link', { name: 'Product', exact: true }).first()
  await expect(product).toHaveAttribute('href', '/#product')

  const shopify = page.getByRole('navigation').getByRole('link', { name: 'For Shopify', exact: true }).first()
  await expect(shopify).toHaveAttribute('href', '/install')

  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Product' })
  ).toBeVisible()
})

test('homepage controls keep practical hit targets and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const primaryControls = [
    page.getByRole('button', { name: 'Open menu' }),
    page.getByRole('button', { name: 'Analyze' }).first(),
    page.getByRole('textbox', { name: 'Website URL' }).first(),
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
