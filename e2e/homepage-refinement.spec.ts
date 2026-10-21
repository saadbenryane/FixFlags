import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { CARE_HOME as C, HOMEPAGE_SAMPLE as S, SAMPLE_FLAGS } from '../lib/marketing/copy/care-homepage'
import { BOARD_PREVIEW_COPY as B } from '../lib/marketing/copy/board-preview'
import { MONITORING_SCHEDULE_COPY as M } from '../lib/marketing/copy/monitoring'
import { SITE_SETTINGS_COPY as Settings } from '../lib/marketing/copy/site-settings'
import { UPTIME_COPY as U } from '../lib/marketing/copy/uptime'
import { INTEGRATIONS_PAGE } from '../lib/marketing/copy/integrations'
import { inspectAccessibilityViolations } from './approved-contrast'

async function visit(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
  await page.goto('/', { waitUntil: 'load' })
  await page.evaluate(value => localStorage.setItem('theme', value), theme)
  await page.reload({ waitUntil: 'load' })
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`))
  const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
  if (await consent.isVisible()) await consent.click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Website URL' }).first()).toBeEnabled()
}

function board(page: Page) { return page.getByRole('region', { name: C.boardAria }) }
async function sharedTargets(page: Page) {
  const undersized = await page.locator('main button, main input, main select, [role="dialog"] button').evaluateAll(nodes =>
    nodes.flatMap(node => {
      const box = node.getBoundingClientRect(), style = getComputedStyle(node)
      return box.width && box.height && style.visibility !== 'hidden' && (box.width < 43.99 || box.height < 43.99)
        ? [{ name: node.getAttribute('aria-label') ?? node.textContent?.trim(), width: box.width, height: box.height }] : []
    }))
  expect(undersized).toEqual([])
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze()
  expect((await inspectAccessibilityViolations(page, result.violations)).failures).toEqual([])
}

for (const width of [320, 375, 390, 768, 1086, 1280, 1440]) for (const theme of ['light', 'dark'] as const) {
  test(`complete homepage reflows at ${width}px in ${theme}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await visit(page, theme)
    await expect(page.getByRole('heading', { level: 1, name: /Website monitoring\.\s*From problem to fix\./ })).toBeVisible()
    for (const input of await page.getByRole('textbox', { name: 'Website URL' }).all())
      expect(await input.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16)
    await expect(board(page).getByText(S.sampleLabel, { exact: true })).toBeVisible()
    for (const category of S.categories) if (category.id !== 'uptime')
      await expect(board(page).getByRole('button', { name: `Open ${category.name}`, exact: true })).toBeVisible()
    await expect(board(page).getByRole('button', { name: U.details, exact: true })).toBeVisible()
    await sharedTargets(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}

test('category depth keeps original Flag scope, evidence, guidance and focus', async ({ page }) => {
  await visit(page)
  const opener = board(page).getByRole('button', { name: 'Open Conversion', exact: true })
  await opener.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Conversion', exact: true })).toBeVisible()
  await expect(dialog.getByText(S.notVerified, { exact: true })).toBeVisible()
  const detail = dialog.getByRole('button', { name: 'View Flag for Add to cart', exact: true })
  await detail.focus(); await page.keyboard.press('Enter')
  await expect(dialog.getByRole('heading', { name: SAMPLE_FLAGS.checkout.title, exact: true })).toBeFocused()
  await expect(dialog.getByText(SAMPLE_FLAGS.checkout.observed, { exact: true })).toBeVisible()
  await expect(dialog.getByText(SAMPLE_FLAGS.checkout.expected, { exact: true })).toBeVisible()
  await expect(dialog.getByRole('link', { name: SAMPLE_FLAGS.checkout.page, exact: true })).toHaveAttribute('href', SAMPLE_FLAGS.checkout.url)
  await expect(dialog.getByRole('link', { name: S.guidanceAction, exact: true })).toHaveAttribute('href', '/docs/fix-with-ai')
  await expect(dialog.getByRole('button', { name: S.recoveryAction, exact: true })).toHaveCount(0)
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  await dialog.getByRole('button', { name: 'Back to Conversion', exact: true }).click()
  await expect(detail).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused()
})

test('mobile depth uses the viewport and each page’s own illustrative capture', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await visit(page)
  const opener = board(page).getByRole('button', { name: 'Open Pages', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog'), box = await dialog.boundingBox()
  expect(box!.width).toBeCloseTo(375, 0); expect(box!.height).toBeCloseTo(812, 0)
  await dialog.getByRole('button', { name: 'View Flag for /pricing', exact: true }).click()
  await expect(dialog.getByRole('img', { name: S.availabilityAlt, exact: true })).toHaveAttribute('src', /pricing-unavailable\.png/)
  await expect(dialog.getByText(S.availabilityObserved, { exact: true })).toBeVisible()
  await expect(dialog.getByRole('link', { name: '/pricing', exact: true })).toHaveAttribute('href', S.sources.http)
  await sharedTargets(page)
  await page.keyboard.press('Escape'); await expect(opener).toBeFocused()
})

test('unverified signup and analytics delivery remain separate from checked observations', async ({ page }) => {
  await visit(page)
  await board(page).getByRole('button', { name: 'Open Conversion', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(S.notVerified, { exact: true })).toBeVisible()
  await expect(dialog.getByText(S.connections, { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await board(page).getByRole('button', { name: 'Open Tracking', exact: true }).click()
  await expect(dialog.getByText('Outside coverage', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Analytics delivery', { exact: true })).toBeVisible()
  await expect(dialog.getByText(/does not prove it reached an analytics account/)).toBeVisible()
})

test('illustrative history, monitoring and HTTP uptime retain separate scope', async ({ page }) => {
  await visit(page)
  await board(page).getByRole('button', { name: U.details, exact: true }).click()
  await expect(page.getByRole('dialog').getByText(U.scope, { exact: false })).toBeVisible()
  await expect(page.getByRole('dialog').getByText(U.limitation, { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await board(page).getByRole('button', { name: 'Timeline', exact: true }).click()
  await expect(board(page).getByText(S.sampleLabel, { exact: true })).toBeVisible()
  await expect(board(page).getByRole('list', { name: B.checkHistory, exact: true })).toBeVisible()
  await board(page).getByRole('button', { name: /^Monitoring:/ }).click()
  await page.getByRole('region', { name: M.title, exact: true }).getByRole('button', { name: M.edit, exact: true }).click()
  const editor = page.getByRole('dialog')
  await expect(editor.getByRole('button', { name: M.updateSample, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await board(page).getByRole('button', { name: Settings.pause, exact: true }).click()
  await expect(board(page).getByRole('button', { name: Settings.resume, exact: true })).toBeVisible()
  await board(page).getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(board(page).getByRole('button', { name: U.details, exact: true })).toContainText(U.states.paused)
  await board(page).getByRole('button', { name: 'Settings', exact: true }).click()
  await board(page).getByRole('button', { name: Settings.resume, exact: true }).click()
  await expect(board(page).getByRole('button', { name: Settings.pause, exact: true })).toBeVisible()
})

test('integration discovery reflects released authorization and parked connections', async ({ page }) => {
  await visit(page)
  for (const integration of INTEGRATIONS_PAGE.items) {
    const card = page.locator(`[data-integration="${integration.id}"]`)
    await expect(card.getByRole('link')).toHaveAttribute('href', `/integrations#${integration.id}`)
    await expect(card.getByText(integration.status === 'available' ? INTEGRATIONS_PAGE.availableLabel : INTEGRATIONS_PAGE.proposedLabel, { exact: true })).toBeVisible()
  }
  await page.getByRole('link', { name: C.integrations.action, exact: true }).click()
  await expect(page).toHaveURL(/\/integrations$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('Analyze preserves the URL in the existing Site handoff', async ({ page }) => {
  let submitted: unknown
  await page.route('**/api/checks', async route => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reportId: 'sample-audit', siteId: 'submitted-site', isLoggedIn: false }) })
  })
  await visit(page)
  await page.getByRole('textbox', { name: 'Website URL' }).first().fill('https://example.com')
  await page.getByRole('button', { name: C.hero.cta, exact: true }).first().click()
  await expect(page).toHaveURL(/\/sites\/submitted-site/, { timeout: 15000 })
  expect(submitted).toMatchObject({ url: 'https://example.com', source: 'homepage' })
})

test('reduced motion and shared controls remain usable across sample views', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await visit(page)
  for (const view of ['Overview', 'Timeline', 'Integrations', 'Settings']) {
    await board(page).getByRole('button', { name: view, exact: true }).click()
    await sharedTargets(page)
    expect(await board(page).evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true)
    expect(await board(page).evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0)
  }
})

test('category depth retains keyboard containment and accessible names in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await visit(page, theme)
    await board(page).getByRole('button', { name: 'Open Pages', exact: true }).click()
    const dialog = page.getByRole('dialog')
    for (const direction of ['Tab', 'Shift+Tab']) for (let step = 0; step < 12; step++) {
      await page.keyboard.press(direction)
      expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
    }
    await accessible(page)
    await page.keyboard.press('Escape')
  }
})

test('brand controls preserve the measured contrast exception in both themes', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await visit(page, theme)
    await page.getByRole('textbox', { name: 'Website URL' }).first().fill('https://example.com')
    const button = page.getByRole('button', { name: C.hero.cta, exact: true }).first()
    for (const hover of [false, true]) {
      if (hover) await button.hover(); else await page.mouse.move(0, 0)
      await page.waitForTimeout(250)
      const contrast = await button.evaluate(node => {
        const style = getComputedStyle(node)
        const luminance = (rgb: string) => {
          const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 })
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
        }
        const fg = luminance(style.color), bg = luminance(style.backgroundColor)
        return { ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), background: style.backgroundColor, foreground: style.color }
      })
      expect(contrast.background).toBe('rgb(255, 90, 0)'); expect(contrast.foreground).toBe('rgb(255, 255, 255)')
      expect(contrast.ratio).toBeCloseTo(3.13, 2)
      await test.info().attach(`approved-orange-${theme}-${hover ? 'hover' : 'rest'}`, { contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ ...contrast, smallTextMinimum: 4.5, approvedException: true, fullWcagAaCompliance: false })) })
    }
    await accessible(page)
  }
})
