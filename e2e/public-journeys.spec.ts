import { expect, test } from '@playwright/test'

const widths = [375, 768, 1280]

test('homepage first-value entry is usable by keyboard', async ({ page }) => {
  const hydrated = page.waitForResponse((response) => response.url().includes('/api/me'))
  await page.goto('/')
  await hydrated
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

  test(`focused sample preview is usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/samples')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
    expect(errors).toEqual([])
  })

  test(`canonical sample exposes its complete fix list at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/samples')

    await expect(page.getByRole('region', { name: 'Fix list with 7 flags' })).toBeVisible()
    await expect(page.getByText(/PlantDad/i).first()).toBeVisible()
    await expect(page.getByText(/fixflags\.com/i)).toHaveCount(0)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const undersizedControls = await page
      .locator('button, input, select, textarea, [role="button"], [role="tab"], header a[href], footer a[href]')
      .evaluateAll((elements) => elements
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          const style = getComputedStyle(element)
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && (rect.width < 44 || rect.height < 44)
        })
        .map((element) => ({
          text: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60),
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        })))
    expect(undersizedControls).toEqual([])
    expect(errors).toEqual([])
  })
}

test('legacy sample details redirects to the canonical report surface', async ({ page }) => {
  await page.goto('/samples/details')
  await expect(page).toHaveURL(/\/samples$/)
  await expect(page.getByRole('region', { name: 'Fix list with 7 flags' })).toBeVisible()
})

test('canonical sample reflows at 200% text size and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/samples')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))
  expect(dimensions.reducedMotion).toBe(true)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

  await page.keyboard.press('Tab')
  const focused = await page.evaluate(() => {
    const active = document.activeElement
    return active !== document.body && active !== document.documentElement
  })
  expect(focused).toBe(true)
})

test('deleted or unknown reports render an explicit not-found state', async ({ page }) => {
  await page.goto('/report/report-that-does-not-exist')
  await expect(page.getByText(/not found|does not exist/i).first()).toBeVisible()
})

test('auth and pricing entry points render without client errors', async ({ page }) => {
  const errors: string[] = []
  const recordError = (error: Error) => {
    const detail = (error.stack || error.message).trim()
    if (detail) errors.push(detail)
  }
  page.on('pageerror', recordError)

  await page.goto('/sign-in')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const pricingPage = await page.context().newPage()
  pricingPage.on('pageerror', recordError)
  await pricingPage.goto('/pricing')
  await expect(pricingPage.getByText('$29')).toBeVisible()
  await expect(pricingPage.getByText('$99')).toBeVisible()
  expect(errors).toEqual([])
})

test('anonymous check reaches a completed report and enforces the one-teaser boundary', async ({ page }) => {
  test.skip(process.env.E2E_FULL !== 'true', 'Set E2E_FULL=true for the queue-backed journey')
  test.setTimeout(240_000)

  const targetUrl = process.env.E2E_AUDIT_URL ?? 'https://example.com'
  await page.goto('/')
  await page.getByLabel('Website URL').first().fill(targetUrl)
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await page.waitForURL(/\/report\//, { timeout: 30_000 })
  const fixList = page.locator('#report-flags')
  await expect(fixList).toBeVisible({ timeout: 180_000 })
  await expect(fixList.getByText(/Create a free account to see evidence/i)).toHaveCount(0)

  const copyButtons = fixList.getByRole('button', { name: /copy prompt/i })
  await expect(copyButtons).toHaveCount(1)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await copyButtons.first().click()
  const copiedPrompt = await page.evaluate(() => navigator.clipboard.readText())
  expect(copiedPrompt.length).toBeGreaterThan(40)
  expect(copiedPrompt).not.toMatch(/create (a free )?account|sign up/i)

  await page.goto('/')
  await page.getByLabel('Website URL').first().fill('https://www.iana.org')
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await expect(page.getByText(/Create (a free )?account/i).first()).toBeVisible()
})
