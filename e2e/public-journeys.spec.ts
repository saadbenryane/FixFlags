import { expect, test } from '@playwright/test'

const widths = [320, 375, 768, 1280]

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

for (const width of [320, 375]) {
  test(`mobile header and Flag selection remain responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/samples')

    const header = page.locator('header').first()
    const logo = header.locator('a[href="/"]').first()
    const review = header.getByRole('link', { name: 'Review my site' })
    await expect(logo).toBeVisible()
    await expect(review).toBeVisible()
    const [logoBox, reviewBox] = await Promise.all([
      logo.boundingBox(),
      review.boundingBox(),
    ])
    expect(logoBox).not.toBeNull()
    expect(reviewBox).not.toBeNull()
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(reviewBox!.x)

    const flags = page.locator('button[aria-controls="selected-flag-detail"]')
    await expect(flags).toHaveCount(7)
    await flags.nth(1).click()
    await expect(flags.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#selected-flag-detail h3[tabindex="-1"]')).toBeFocused()
  })
}

test('legacy sample details redirects to the canonical report surface', async ({ page }) => {
  await page.goto('/samples/details')
  await expect(page).toHaveURL(/\/samples(?:\?flag=[^#]+)?$/)
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

test('legacy report details path redirects after access checks', async ({ page }) => {
  await page.goto('/report/report-that-does-not-exist/details')
  await expect(page.getByText(/not found|does not exist|access denied/i).first()).toBeVisible()
})

test('unknown share tokens render an unavailable or not-found state', async ({ page }) => {
  await page.goto('/share/revoked-or-unknown-share-token')
  await expect(
    page.locator('main').getByText(/not found|does not exist|unavailable/i).first()
  ).toBeVisible()
})

test('docs and legacy MCP setup surfaces render without client errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/help/mcp')
  await expect(page).toHaveURL(/\/docs\/integrations$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByText(/Lovable|Bolt|Cursor/i).first()).toBeVisible()

  await page.goto('/docs/mcp')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(errors).toEqual([])
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
  await expect(pricingPage.getByText('$69', { exact: true })).toBeVisible()
  await expect(pricingPage.getByText('$199', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

for (const width of widths) {
  test(`auth shell keeps its wordmark and controls in bounds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()

    const geometry = await page.evaluate(() => {
      const logo = document.querySelector<HTMLElement>('header a[href="/"]')
      const rect = logo?.getBoundingClientRect()
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        logoText: logo?.textContent?.trim(),
        logoLeft: rect?.left ?? -1,
        logoRight: rect?.right ?? Number.POSITIVE_INFINITY,
        logoClientWidth: logo?.clientWidth ?? 0,
        logoScrollWidth: logo?.scrollWidth ?? 1,
      }
    })

    expect(geometry.logoText).toBe('FixFlags')
    expect(geometry.logoLeft).toBeGreaterThanOrEqual(0)
    expect(geometry.logoRight).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.logoScrollWidth).toBeLessThanOrEqual(geometry.logoClientWidth)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
  })
}

test('auth shell supports light and dark themes without reflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/sign-in')
  const themeToggle = page.locator('footer').getByRole('button', { name: 'Toggle theme' })
  await expect(themeToggle).toBeVisible()
  await themeToggle.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('anonymous check reaches a completed report and enforces the one-teaser boundary', async ({ page }) => {
  test.skip(process.env.E2E_FULL !== 'true', 'Set E2E_FULL=true for the queue-backed journey')
  test.setTimeout(240_000)

  const targetUrl = process.env.E2E_AUDIT_URL ?? 'https://example.com'
  await page.goto('/')
  await page.getByLabel('Website URL').first().fill(targetUrl)
  await page.getByRole('button', { name: 'Review my site' }).first().click()
  await page.waitForURL(/\/report\//, { timeout: 30_000 })
  const reportId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
  await expect.poll(async () => {
    const response = await page.request.get(`/api/reports/${reportId}/status`)
    const body = (await response.json().catch(() => null)) as { status?: string } | null
    return body?.status
  }, { timeout: 240_000 }).toBe('COMPLETED')
  await page.reload()
  const fixList = page.locator('#report-flags')
  await expect(fixList).toBeVisible()
  await expect(fixList.getByText(/Create a free account to see evidence/i)).toHaveCount(0)

  const flags = fixList.locator('button[aria-controls="selected-flag-detail"]')
  await expect.poll(() => flags.count(), { timeout: 180_000 }).toBeGreaterThan(0)
  const flagCount = await flags.count()
  const promptFlagIndexes: number[] = []
  for (let index = 0; index < flagCount; index += 1) {
    await flags.nth(index).click()
    await expect(flags.nth(index)).toHaveAttribute('aria-pressed', 'true')
    if (await fixList.getByRole('button', { name: /copy prompt/i }).count()) {
      promptFlagIndexes.push(index)
    }
  }
  expect(promptFlagIndexes).toHaveLength(1)
  await flags.nth(promptFlagIndexes[0]!).click()
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
