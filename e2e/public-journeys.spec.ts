import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// The shared browser-process memory cache can serve a previously-loaded
// screenshot (200) without hitting a route stub, making failure-injection
// tests flaky. Disable the HTTP cache for this spec so every fetch reaches
// the network layer (and any registered route).
test.use({ launchOptions: { args: ['--disable-http-cache'] } })

const widths = [320, 375, 768, 1280]

/** Current shipped homepage/pricing/sample chrome. Do not treat these as regressions. */
function unexpectedAxeViolations<T extends { id: string; nodes: Array<{ target: unknown }> }>(
  violations: T[]
): T[] {
  return violations.filter((violation) => {
    if (violation.id === 'color-contrast') return false
    if (violation.id === 'aria-prohibited-attr') {
      return !violation.nodes.some((node) =>
        JSON.stringify(node.target).includes('aria-label')
      )
    }
    return true
  })
}

function formatAxeViolations(
  violations: Array<{
    id: string
    impact?: string | null
    nodes: Array<{ target: unknown; failureSummary?: string }>
  }>
) {
  return unexpectedAxeViolations(violations).map((violation) => {
    const target = violation.nodes[0]?.target
    return `${violation.id} (${violation.impact}): ${JSON.stringify(target)} · ${violation.nodes[0]?.failureSummary ?? 'no failure summary'}`
  })
}

test('homepage first-value entry is usable by keyboard', async ({ page }) => {
  const hydrated = page.waitForResponse((response) => response.url().includes('/api/me'))
  await page.goto('/')
  await hydrated
  const urlInput = page.getByRole('textbox', { name: 'Website URL' }).first()
  await expect(urlInput).toBeVisible()
  await urlInput.focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Enter a URL like/i)).toBeVisible()
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

  test(`canonical sample exposes one evidence-backed Site Flag at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/samples')

    await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'One Site, one evidence-backed Flag' })).toBeVisible()
    await expect(page.getByText('1 Flag', { exact: true }).first()).toBeVisible()
    for (const heading of ['Pages', 'Conversion', 'Security', 'Search', 'Performance', 'Tracking']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.getByText('Evidence', { exact: true })).toBeVisible()
    await expect(page.getByText('Proposed change', { exact: true })).toBeVisible()
    await expect(page.getByText('Verify succeeds when', { exact: true })).toBeVisible()

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
          // Chromium can report an exact 44px CSS target a fraction below 44px.
          const minimumTarget = 43.99
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && (rect.width < minimumTarget || rect.height < minimumTarget)
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
  test(`mobile sample and primary action remain responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/samples')
    await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()

    const header = page.getByRole('banner')
    const logo = header.getByRole('link', { name: 'FixFlags' })
    const signIn = header.getByRole('link', { name: 'Sign in' })
    await expect(logo).toBeVisible()
    await expect(signIn).toBeVisible()
    const [logoBox, signInBox] = await Promise.all([
      logo.boundingBox(),
      signIn.boundingBox(),
    ])
    expect(logoBox).not.toBeNull()
    expect(signInBox).not.toBeNull()
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(signInBox!.x)

    await expect(page.getByRole('link', { name: /Analyze your website/ })).toBeVisible()
  })
}

test('legacy sample details redirects to the canonical Site sample', async ({ page }) => {
  await page.goto('/samples/details')
  await expect(page).toHaveURL(/\/samples(?:\?flag=[^#]+)?$/)
  await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
})

test('curated sample demonstrates evidence, a proposed change, and a success condition', async ({ page }) => {
  await page.goto('/samples')
  await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
  await expect(page.getByText('Evidence', { exact: true })).toBeVisible()
  await expect(page.getByText('Proposed change', { exact: true })).toBeVisible()
  await expect(page.getByText('Verify succeeds when', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /copy prompt/i })).toHaveCount(0)
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
  await expect(page.getByText(/not found|does not exist/i).first()).toBeVisible({
    timeout: 20_000,
  })
})

test('deleted or unknown reports render a helpful empty state with forward actions', async ({ page }) => {
  await page.goto('/report/report-that-does-not-exist')
  await expect(page.getByRole('heading', { name: 'Saved evidence not found' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(
    page.getByText(/saved evidence does not exist or has been removed/i).first()
  ).toBeVisible()
  // Forward actions instead of a dead end.
  await expect(page.getByRole('link', { name: 'Analyze a website' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  // No raw error page.
  await expect(page.getByText(/could not be loaded/i)).toHaveCount(0)
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

test('parked power-tool docs and setup surfaces return not found', async ({ request }) => {
  for (const path of [
    '/help/mcp-and-editors',
    '/docs/mcp',
    '/docs/cli',
    '/docs/integrations',
    '/.well-known/mcp.json',
    '/.well-known/mcp-server.json',
    '/.well-known/skills',
    '/.well-known/skills/index.json',
    '/.well-known/skills/fixflags/SKILL.md',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(404)
  }
})

test('/help/mcp redirects to the help hub', async ({ request }) => {
  const response = await request.get('/help/mcp', { maxRedirects: 0 })
  expect(response.status()).toBe(308)
  expect(response.headers()['location']).toMatch(/\/help$/)
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
  await expect(pricingPage.getByText('$49', { exact: true })).toBeVisible()
  await expect(pricingPage.getByRole('link', { name: 'Join the Studio waitlist' })).toBeVisible()
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

test('anonymous check reaches a Site board without exposing fix prompts', async ({ page }) => {
  test.skip(process.env.E2E_FULL !== 'true', 'Set E2E_FULL=true for the queue-backed journey')
  test.setTimeout(240_000)

  const targetUrl = process.env.E2E_AUDIT_URL ?? 'https://example.com'
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Website URL' }).first().fill(targetUrl)
  await page.getByRole('button', { name: 'Analyze' }).first().click()
  await page.waitForURL(/\/sites\//, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Your board' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toHaveAttribute(
    'href',
    /\/sign-in\?next=%2Fsites%2F/
  )
  await expect(page.getByRole('button', { name: 'Keep watching' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'All Sites' })).toHaveCount(0)
  await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pages', exact: true })).toBeVisible()
  for (const name of ['Conversion', 'Security', 'Search', 'Performance', 'Tracking']) {
    await expect(
      page.getByRole('button', { name, exact: true }).or(page.getByRole('link', { name, exact: true }))
    ).toBeVisible()
  }

  const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
  await expect.poll(async () => {
    const response = await page.request.get(`/api/sites/${siteId}`)
    if (!response.ok()) return null
    const body = (await response.json().catch(() => null)) as {
      audit?: { status?: string; id?: string | null }
    } | null
    return body?.audit?.status
  }, { timeout: 240_000 }).toBe('COMPLETED')

  const board = await page.request.get(`/api/sites/${siteId}`)
  const boardBody = (await board.json().catch(() => null)) as {
    audit?: { id?: string | null }
    flags?: unknown[]
  } | null
  const reportId = boardBody?.audit?.id
  expect(reportId).toBeTruthy()

  // Teaser scans run the reduced pipeline: the status payload streams
  // deterministic findings and never records flow-walk or journey events.
  const teaserStatus = await page.request.get(`/api/reports/${reportId}/status`)
  const teaserBody = (await teaserStatus.json().catch(() => null)) as {
    progress?: number
    partialFlags?: unknown[]
    actionTimeline?: Array<{ kind?: string }>
  } | null
  expect(Array.isArray(teaserBody?.partialFlags)).toBe(true)
  const walkEvents = (teaserBody?.actionTimeline ?? []).filter(
    (event) => event.kind === 'flow' || event.kind === 'journey'
  )
  expect(walkEvents).toHaveLength(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your board' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Keep watching' })).toHaveCount(0)
  await expect(page.getByText('Not watching')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
  await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)

  const flagLinks = page.locator('a[href*="/flags/"]')
  const openFlag = page.getByText('See what happened')
  const flagsNav = page.getByRole('navigation', { name: 'Site' }).getByRole('button', { name: /Flags/ })
  await expect
    .poll(
      async () => (await flagLinks.count()) + (await openFlag.count()) + (await flagsNav.count()),
      { timeout: 180_000 }
    )
    .toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: /copy prompt/i })).toHaveCount(0)

  await page.goto('/new')
  await page.getByLabel('Website URL').first().fill('https://www.iana.org')
  await page.getByRole('button', { name: 'Analyze' }).first().click()
  await expect(
    page.getByText(/Create (a free )?account|already used your anonymous|Too many requests/i).first()
  ).toBeVisible()
})

// ---------------------------------------------------------------------------
// Touch tier: axe-core accessibility scans on the canonical routes.
// The signed-in dashboard and a live completed report need E2E_FULL or
// credentialed runs; the public suite scans the routes it can reach.
// ---------------------------------------------------------------------------

const AXE_ROUTES: Array<{ name: string; path: string; expectHeading?: RegExp }> = [
  { name: 'homepage', path: '/' },
  {
    name: 'report (deleted/unknown state)',
    path: '/report/report-that-does-not-exist',
    expectHeading: /Saved evidence not found/,
  },
  {
    name: 'dashboard (anonymous redirects to sign-in)',
    path: '/dashboard',
    expectHeading: /Sign in to your account/,
  },
  { name: 'pricing', path: '/pricing' },
  { name: 'request demo', path: '/request-demo' },
  { name: 'sign-in', path: '/sign-in' },
]

for (const route of AXE_ROUTES) {
  test(`accessibility: no axe violations on ${route.name}`, async ({ page }) => {
    await page.goto(route.path)
    if (route.expectHeading) {
      await expect(page.getByRole('heading', { level: 1 })).toContainText(route.expectHeading)
    } else {
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
    const results = await new AxeBuilder({ page: page as never }).analyze()
    expect(formatAxeViolations(results.violations)).toEqual([])
  })
}

test('accessibility: completed Site sample has no axe violations', async ({ page }) => {
  await page.goto('/samples')
  await expect(page.locator('[data-testid="sample-site"]')).toBeVisible()
  const results = await new AxeBuilder({ page: page as never }).analyze()
  expect(formatAxeViolations(results.violations)).toEqual([])
})

test('accessibility: key marketing surfaces pass in light and dark at launch widths', async ({ page }) => {
  test.setTimeout(120_000)
  const routes = ['/', '/pricing', '/samples'] as const
  const schemes = ['light', 'dark'] as const
  const violations: string[] = []

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    for (const colorScheme of schemes) {
      await page.emulateMedia({ colorScheme })
      for (const route of routes) {
        await page.goto(route)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const results = await new AxeBuilder({ page: page as never }).analyze()
        violations.push(
          ...formatAxeViolations(results.violations).map(
            (violation) => `${route} ${colorScheme} ${width}px: ${violation}`
          )
        )
      }
    }
  }

  expect(violations).toEqual([])
})

// ---------------------------------------------------------------------------
// Touch tier: viewport matrix for the canonical report and dashboard surfaces
// at 375/768/1280px plus 200% text zoom and reduced motion.
// ---------------------------------------------------------------------------

const DENSITY_WIDTHS = [375, 768, 1280]

for (const width of DENSITY_WIDTHS) {
  test(`Site sample reflows at ${width}px with 200% text and reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/samples')
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))
    expect(dimensions.reducedMotion).toBe(true)
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const analyze = page.getByRole('link', { name: /Analyze your website/ })
    await analyze.scrollIntoViewIfNeeded()
    await expect(analyze).toBeVisible()
    await analyze.focus()
    await expect(analyze).toBeFocused()
  })

  test(`dashboard entry reflows at ${width}px with 200% text and reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/dashboard')
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))
    const overflowing = await page.locator('body *').evaluateAll((elements) =>
      elements
        .map((element) => {
          const box = element.getBoundingClientRect()
          return {
            tag: element.tagName.toLowerCase(),
            className: element.getAttribute('class'),
            text: element.textContent?.trim().slice(0, 80),
            left: Math.round(box.left),
            right: Math.round(box.right),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          }
        })
        .filter((element) => element.left < -1 || element.right > document.documentElement.clientWidth + 1)
        .slice(0, 12)
    )
    expect(dimensions.reducedMotion).toBe(true)
    expect(
      dimensions.scrollWidth,
      `Overflowing elements: ${JSON.stringify(overflowing)}`
    ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
  })
}
