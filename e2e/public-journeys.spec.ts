import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { inspectAccessibilityViolations } from './approved-contrast'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { CARE_HOME, HOMEPAGE_SAMPLE } from '@/lib/marketing/copy/care-homepage'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { BILLING_ACTION_COPY } from '@/lib/marketing/copy/plans'
import { AUTH } from '@/lib/marketing/copy/auth'
import type { SiteHomeView } from '@/lib/sites/site-home'

// Context routing disables HTTP cache in every supported engine. Page routes
// retain precedence so failure injection observes the actual network request.
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => route.continue())
})

const widths = [320, 375, 768, 1280]

for (const height of [900, 225]) {
  test(`consent and copy feedback leave focused controls reachable at 375x${height}`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 375, height })
    if (browserName === 'chromium') await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/')
    const consent = page.getByRole('dialog', { name: 'Choose your analytics settings' })
    await expect(consent).toBeVisible()
    const copy = page.getByRole('button', { name: SITE_DASHBOARD_COPY.fixAll, exact: true })
    await copy.click()
    const manual = page.getByRole('textbox', { name: HOMEPAGE_SAMPLE.guidanceLabel, exact: true })
    if (await manual.isVisible()) {
      await manual.focus()
      await expect.poll(() => manual.evaluate(element => element instanceof HTMLTextAreaElement &&
        element.selectionStart === 0 && element.selectionEnd === element.value.length)).toBe(true)
      await page.getByRole('dialog').filter({ has: manual }).getByRole('button', { name: 'Close', exact: true }).click()
    }
    const choice = consent.getByRole('button', { name: 'Only necessary', exact: true })
    await choice.focus()
    await expect.poll(() => choice.evaluate(element => {
      const box = element.getBoundingClientRect()
      const visible = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return Boolean(visible && element.contains(visible))
    })).toBe(true)
    await choice.click()
    await expect(consent).toHaveCount(0)
    await page.getByRole('button', { name: 'Cookie settings', exact: true }).click()
    await expect.poll(() => page.evaluate(() => {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement)) return false
      const box = focused.getBoundingClientRect()
      const visible = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
      return Boolean(visible && focused.contains(visible))
    })).toBe(true)
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
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
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

  test(`canonical sample exposes dated evidence and an independent recovery criterion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/samples')

    await expect(page.locator('[data-testid="sample-site"]:visible')).toBeVisible()
    const sample = page.locator('[data-testid="sample-site"]:visible')
    await expect(sample).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(PUBLIC_SITE_COPY.samplePage.title)
    await expect(sample).toHaveAttribute('data-observation', /^curated-sample-/)
    for (const heading of ['observed', 'fix', 'prompt', 'verification'] as const)
      await expect(sample.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage[heading], exact: true })).toBeVisible()
    const image = sample.getByRole('img', { name: PUBLIC_SITE_COPY.samplePage.imageAlt })
    await image.scrollIntoViewIfNeeded()
    await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true)
    await expect(sample.getByText(PUBLIC_SITE_COPY.samplePage.verificationBody)).toBeVisible()
    await sample.getByText(PUBLIC_SITE_COPY.samplePage.provenance, { exact: true }).click()
    await expect(sample.getByText(PUBLIC_SITE_COPY.samplePage.provenanceBody)).toBeVisible()
    await expect(sample.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/)

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const undersizedControls = await page
      .locator('button, input, select, textarea, [role="button"], [role="tab"], header a[href], footer a[href]')
      .evaluateAll((elements) => elements
        .filter((element) => {
          // Next's development-only shadow toolbar is framework tooling.
          // Every customer control remains subject to the touch requirement.
          const root = element.getRootNode()
          if (root instanceof ShadowRoot && root.host.tagName === 'NEXTJS-PORTAL') return false
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
    await expect(page.locator('[data-testid="sample-site"]:visible')).toBeVisible()

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

    await expect(page.getByRole('link', { name: PUBLIC_SITE_COPY.analyze, exact: true })).toBeVisible()
  })
}

test('legacy sample details redirects to the canonical Site sample', async ({ page }) => {
  await page.goto('/samples/details')
  await expect(page).toHaveURL(/\/samples(?:\?flag=[^#]+)?$/)
  await expect(page.locator('[data-testid="sample-site"]:visible')).toBeVisible()
})

test('curated sample demonstrates evidence, a proposed change, and a success condition', async ({ page }) => {
  await page.goto('/samples')
  await expect(page.locator('[data-testid="sample-site"]:visible')).toBeVisible()
  await expect(page.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage.observed, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage.fix, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: PUBLIC_SITE_COPY.samplePage.verification, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: PUBLIC_SITE_COPY.samplePage.copy, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /verify|mark fixed/i })).toHaveCount(0)
})

test('canonical sample reflows at 200% text size and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/samples')
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })
  await page.evaluate(() => document.fonts.ready)

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

test('parked power-tool help stays closed and website connection Docs remain available', async ({ request, page }) => {
  for (const path of [
    '/help/mcp-and-editors',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(404)
  }
  await page.goto('/docs/integrations')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Integration guides')
  await expect(page.getByRole('heading', { name: 'Available integrations' })).toBeVisible()
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
  await pricingPage.getByRole('link', { name: BILLING_ACTION_COPY.waitlist.submitStudio, exact: true }).click()
  await expect(pricingPage).toHaveURL(/\/waitlist\/studio$/)
  await expect(pricingPage.getByRole('heading', { level: 1 })).toBeVisible()
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
  await page.getByRole('button', { name: 'Only necessary' }).click()
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
  const host = new URL(targetUrl).host
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Website URL' }).first().fill(targetUrl)
  await page.getByRole('button', { name: CARE_HOME.hero.cta, exact: true }).first().click()
  await page.waitForURL(/\/sites\//, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: host, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Settings', exact: true }).first()).toHaveAttribute(
    'href',
    /\/sign-in\?next=%2Fsites%2F/
  )
  await expect(page.getByRole('button', { name: 'Keep watching' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'All Sites' })).toHaveCount(0)
  await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Pages', exact: true })).toBeVisible()
  for (const name of ['Conversion', 'Security', 'Search', 'Performance', 'Tracking', 'Accessibility', 'Uptime']) {
    await expect(
      page.getByRole('button', { name: `Open ${name}`, exact: true })
    ).toBeVisible()
  }

  const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
  // Chromium sends Secure creator cookies on trusted loopback. APIRequestContext
  // does not, so exercise the same authenticated fetch path as the dashboard.
  const creatorRead = (path: string) => page.evaluate(async path => {
    const response = await fetch(path, { cache: 'no-store' })
    return { status: response.status, body: await response.json().catch(() => null) }
  }, path)
  await expect.poll(async () => {
    const response = await creatorRead(`/api/sites/${siteId}`)
    if (response.status !== 200) return `HTTP ${response.status}`
    const body = response.body as {
      audit?: { status?: string; id?: string | null }
    } | null
    return body?.audit?.status
  }, { timeout: 240_000 }).toBe('COMPLETED')

  const board = await creatorRead(`/api/sites/${siteId}`)
  expect(board.status).toBe(200)
  const boardBody = board.body as SiteHomeView
  const reportId = boardBody?.audit?.id
  expect(reportId).toBeTruthy()
  expect(boardBody.monitoringHistory).toEqual([expect.objectContaining({ id: reportId, status: 'COMPLETED' })])
  expect(boardBody.monitoringTrend).toEqual([expect.objectContaining({ id: reportId, scope: 'SITE' })])

  // Teaser scans run the reduced pipeline: the status payload streams
  // deterministic findings and never records flow-walk or journey events.
  const teaserStatus = await creatorRead(`/api/reports/${reportId}/status`)
  expect(teaserStatus.status).toBe(200)
  const teaserBody = teaserStatus.body as {
    progress?: number
    partialFlags?: Array<Record<string, unknown>>
    actionTimeline?: Array<{ kind?: string }>
  } | null
  expect(Array.isArray(teaserBody?.partialFlags)).toBe(true)
  for (const finding of teaserBody?.partialFlags ?? []) {
    for (const key of ['agentPrompt', 'cursorPrompt', 'claudePrompt', 'lovablePrompt', 'boltPrompt']) {
      expect(finding[key] ?? null, `Anonymous ${key} remains private`).toBeNull()
    }
  }
  const walkEvents = (teaserBody?.actionTimeline ?? []).filter(
    (event) => event.kind === 'flow' || event.kind === 'journey'
  )
  expect(walkEvents).toHaveLength(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: host, exact: true })).toBeVisible()
  const checkAgain = page.getByRole('button', { name: 'Check again', exact: true }).first()
  await expect(checkAgain).toBeVisible()
  await checkAgain.click()
  const authentication = page.getByRole('dialog', { name: AUTH.signUp.title, exact: true })
  await expect(authentication.getByLabel('Email')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe(`/sites/${siteId}`)
  await page.keyboard.press('Escape')
  await expect(authentication).toBeHidden()
  await expect(checkAgain).toBeFocused()
  await expect(page.getByRole('complementary', { name: 'App' })).toBeVisible()
  await expect(page.getByText('Flags over time', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Keep watching' })).toHaveCount(0)
  await expect(page.getByText('Not watching')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add card' })).toHaveCount(0)
  await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)

  await page.getByRole('link', { name: 'Timeline', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Check history', exact: true })).toBeVisible()
  await expect(page.getByText('Check history appears after the first check.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('This Site has recorded analysis. Detailed history is unavailable for this evidence.', { exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Overview', exact: true }).click()

  // A healthy target need not produce a Flag. Existing findings still cannot
  // expose a private fix prompt through the anonymous action endpoint.
  for (const flag of boardBody.flags) {
    const response = await page.evaluate(async path => {
      const result = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'copy' }) })
      return { status: result.status, body: await result.json() }
    }, `/api/sites/${siteId}/flags/${flag.id}/fix`)
    expect([401, 403]).toContain(response.status)
    expect(response.body.prompt).toBeUndefined()
  }
  await expect(page.getByRole('button', { name: /verify|mark fixed/i })).toHaveCount(0)

  await page.goto('/new')
  await page.getByLabel('Website URL').first().fill('https://www.iana.org')
  await page.getByRole('button', { name: PUBLIC_SITE_COPY.analyze, exact: true }).first().click()
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
    expect((await inspectAccessibilityViolations(page, results.violations)).failures).toEqual([])
  })
}

test('accessibility: completed Site sample has no axe violations', async ({ page }) => {
  await page.goto('/samples')
  await expect(page.locator('[data-testid="sample-site"]:visible')).toBeVisible()
  const results = await new AxeBuilder({ page: page as never }).analyze()
  expect((await inspectAccessibilityViolations(page, results.violations)).failures).toEqual([])
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
        await page.evaluate(theme => localStorage.setItem('theme', theme), colorScheme)
        await page.reload()
        await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${colorScheme}\\b`))
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const results = await new AxeBuilder({ page: page as never }).analyze()
        violations.push(
          ...(await inspectAccessibilityViolations(page, results.violations)).failures.map(
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
    await page.locator('[data-testid="sample-site"]:visible').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }))
    expect(dimensions.reducedMotion).toBe(true)
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)

    const analyze = page.getByRole('link', { name: PUBLIC_SITE_COPY.analyze, exact: true })
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
    await page.evaluate(() => document.fonts.ready)
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
