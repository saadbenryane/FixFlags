import { expect, test } from '@playwright/test'

for (const width of [375, 390, 1086, 1144]) {
  test(`refined homepage remains complete at ${width}px`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: width < 600 ? 844 : 732 })
    await page.goto('/')

    await expect(
      page.getByRole('heading', { level: 1, name: /Your software runs\.\s*FixFlags watches\./i })
    ).toBeVisible()
    await expect(
      page.getByText('Know when your website is down, Checkout stops working, or Signup breaks. FixFlags checks the live experience and raises a Flag with what failed.', { exact: true }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: /Different tools watch different layers/ })
    ).toBeAttached()

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

  const integrations = page.getByRole('navigation').getByRole('link', { name: 'Integrations', exact: true }).first()
  await expect(integrations).toHaveAttribute('href', '/integrations')

  const analyze = page.getByRole('link', { name: 'Analyze', exact: true }).first()
  await expect(analyze).toHaveAttribute('href', '/#analyze')
  await analyze.click()
  await expect(page.getByRole('textbox', { name: 'Website URL' }).first()).toBeFocused()

  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Product' })
  ).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Analyze' })).toHaveAttribute('href', '/#analyze')
})

test('homepage exposes three outcome cards and four monitoring states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Is the site reachable?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Can customers buy?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Can people sign up?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Website is down' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Checkout stopped working' }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Signup no longer completes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Checkout works again' })).toBeVisible()
  await expect(page.getByRole('tablist')).toHaveCount(0)

  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  expect(height).toBeLessThanOrEqual(7900)
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
