import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import { CARE_HOME as C, HOMEPAGE_SAMPLE as S } from '../lib/marketing/copy/care-homepage'

async function visit(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Website URL' }).first()).toBeEnabled()
  const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
  if (await consent.isVisible()) await consent.click()
}

for (const width of [320, 390, 768, 1086, 1280, 1440]) {
  test(`complete homepage reflows at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await visit(page)
    await expect(page.getByRole('heading', { level: 1, name: /Your software runs\.\s*FixFlags watches\./ })).toBeVisible()
    const board = page.getByRole('region', { name: C.boardAria })
    for (const card of S.categories) {
      const tile = board.getByRole('button', { name: `Open ${card.name}` })
      await expect(tile).toBeVisible()
      const geometry = await tile.evaluate(node => {
        const title = node.querySelector('strong')!; const spans = node.querySelectorAll('span')
        return { overflow: node.scrollWidth > node.clientWidth, font: getComputedStyle(title).fontSize, height: node.getBoundingClientRect().height, spans: spans.length }
      })
      expect(geometry.overflow).toBe(false)
      expect(geometry.font).toBe('18px')
      expect(geometry.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('table')).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('category depth, Flag scope, sample recovery, keyboard and focus return', async ({ page }) => {
  await visit(page)
  const opener = page.getByRole('button', { name: 'Open Conversion', exact: true })
  await opener.focus(); await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Safe Signup', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: S.detailAction }).click()
  await expect(dialog.getByRole('heading', { name: C.flag.title })).toBeFocused()
  await expect(dialog.getByRole('img', { name: C.flag.cropAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-broken.png')
  await dialog.getByRole('button', { name: S.recoveryAction }).click()
  await expect(dialog.getByRole('img', { name: S.proofAlt })).toHaveAttribute('src', '/marketing/evidence/purchase-verified.png')
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused()
  await page.getByRole('button', { name: 'Open Pages', exact: true }).click()
  await dialog.getByRole('button', { name: S.detailAction }).click()
  await expect(dialog.getByRole('img', { name: S.availabilityAlt })).toHaveAttribute('src', '/marketing/evidence/pricing-unavailable.png')
  await expect(dialog.getByText(S.unresolved)).toBeVisible()
  await expect(dialog.getByRole('button', { name: S.recoveryAction })).toHaveCount(0)
})

test('mobile depth uses the viewport and returns to the real URL field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await visit(page)
  await page.getByRole('button', { name: S.coverageAction }).click()
  const dialog = page.getByRole('dialog'); const box = await dialog.boundingBox()
  expect(box!.width).toBeCloseTo(390, 0); expect(box!.height).toBeCloseTo(844, 0)
  await expect(dialog.getByText(C.coverage.boundary)).toBeAttached()
  await dialog.getByRole('link', { name: S.analyzeAction }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Website URL' }).first()).toBeFocused()
})

test('unknown states remain visible and scheduled scope stays explicit', async ({ page }) => {
  await visit(page)
  await page.getByRole('button', { name: 'Open Performance', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Unavailable', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Recommendation', { exact: true })).toBeVisible()
  await expect(dialog.getByText('0 Flags', { exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: S.watchAction }).click()
  await expect(page.getByText(C.monitoring.sample)).toBeVisible()
  await expect(page.getByText('Not scheduled', { exact: true })).toBeVisible()
  await expect(page.getByText(C.monitoring.note)).toBeVisible()
  const slider = page.getByRole('slider', { name: C.workflow.compareLabel }); await slider.focus()
  await page.keyboard.press('End'); await expect(slider).toHaveAttribute('aria-valuenow', '100')
  await page.keyboard.press('Home'); await expect(slider).toHaveAttribute('aria-valuenow', '0')
})

test('Analyze validates and submits through the existing Site handoff', async ({ page }) => {
  let submitted: unknown
  await page.route('**/api/checks', async route => {
    submitted = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reportId: 'sample-audit', siteId: 'submitted-site', isLoggedIn: false }) })
  })
  await visit(page)
  const field = page.getByRole('textbox', { name: 'Website URL' }).first()
  await field.fill('https://example.com')
  await page.getByRole('button', { name: 'Analyze', exact: true }).first().click()
  await expect(page).toHaveURL(/\/sites\/submitted-site/, { timeout: 15000 })
  expect(submitted).toMatchObject({ url: 'https://example.com', source: 'homepage' })
})

test('reduced motion and sample controls retain usable targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await visit(page)
  const controls = [page.getByRole('button', { name: 'Analyze', exact: true }).first(), page.getByRole('button', { name: S.coverageAction }), page.getByRole('slider')]
  for (const control of controls) {
    const box = await control.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44); expect(box!.width).toBeGreaterThanOrEqual(44)
  }
  const animations = await page.locator('#product').evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)
  expect(animations).toBe(0)
})

test('captures the actual local experience when requested', async ({ page }) => {
  test.skip(process.env.FIXFLAGS_CAPTURE_HOMEPAGE_EVIDENCE !== '1', 'Explicit visual evidence capture')
  const output = '.agents/artifacts/homepage-experience'; await mkdir(output, { recursive: true })
  for (const [name, width] of [['desktop', 1440], ['mobile', 390]] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await visit(page)
    await page.evaluate(async () => { await document.fonts.ready; for (const image of document.images) image.loading = 'eager' })
    await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0))
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true })
    await page.locator('#product').screenshot({ path: `${output}/${name}-board.png` })
  }
})


test('brand buttons retain Flag Orange and meet contrast in both themes', async ({ page }) => {
  await visit(page)
  await page.getByRole('textbox', { name: 'Website URL' }).first().fill('https://example.com')
  const button = page.getByRole('button', { name: 'Analyze', exact: true }).first()
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    for (const hover of [false, true]) {
      if (hover) await button.hover(); else await page.mouse.move(0, 0)
      await page.waitForTimeout(250)
      const contrast = await button.evaluate(node => {
        const style = getComputedStyle(node)
        const luminance = (rgb: string) => {
          const channels = rgb.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
            const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4
          })
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
        }
        const fg = luminance(style.color), bg = luminance(style.backgroundColor)
        return { ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05), background: style.backgroundColor }
      })
      if (!hover) expect(contrast.background).toBe('rgb(255, 90, 0)')
      expect(contrast.ratio).toBeGreaterThanOrEqual(4.5)
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(result.violations.map(item => ({ id: item.id, targets: item.nodes.map(node => node.target) }))).toEqual([])
  }
})
