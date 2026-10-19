import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { inspectAccessibilityViolations } from './approved-contrast'

/**
 * The launch bar for an authenticated Outcome surface, checked in one pass:
 *
 * - 320 / 375 / 768 / 1280 CSS pixels, so reflow holds at the narrowest phone.
 * - 200% text at every width, with 400% browser-zoom reflow modeled by the
 *   equivalent 320 CSS pixel layout. Root font resizing is a separate check.
 * - No horizontal overflow at any of those sizes.
 * - No automated accessibility violation beyond the approved control contrast exception.
 * - Practical touch targets on every interactive control.
 * - Keyboard reachability with a visible focus indicator.
 *
 * Marketing and public surfaces have their own matrix in
 * `public-journeys.spec.ts`; this covers the surfaces that need a signed-in owner.
 */

type Density = { width: number; textPercent: number; colorScheme: 'light' | 'dark'; modeledBrowserZoom?: number }

const DENSITIES: Density[] = [
  { width: 320, textPercent: 200, colorScheme: 'light' },
  { width: 375, textPercent: 200, colorScheme: 'light' },
  { width: 768, textPercent: 200, colorScheme: 'dark' },
  { width: 1280, textPercent: 200, colorScheme: 'light' },
  { width: 320, textPercent: 100, colorScheme: 'light', modeledBrowserZoom: 400 },
  { width: 320, textPercent: 100, colorScheme: 'dark', modeledBrowserZoom: 400 },
]

const INTERACTIVE = 'main a[href], main button, main input, main select, main textarea, main [role="button"], main [role="radio"], main [tabindex]:not([tabindex="-1"])'

async function setTextZoom(page: Page, percent: number): Promise<void> {
  await page.evaluate(async (size) => {
    document.documentElement.style.fontSize = `${size}%`
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  }, percent)
}

export async function assertSiteSurfaceMeetsLaunchBar(page: Page, url: string): Promise<void> {
  for (const density of DENSITIES) {
    const label = `${density.width}px at ${density.textPercent}% text${density.modeledBrowserZoom ? `, modeled ${density.modeledBrowserZoom}% browser reflow from 1280px` : ''}`
    await page.setViewportSize({ width: density.width, height: 900 })
    await page.emulateMedia({ colorScheme: density.colorScheme, reducedMotion: 'reduce' })
    await page.goto(url)
    // next-themes defaults to light, so OS media emulation alone does not
    // establish that the customer's saved dark theme was rendered.
    await page.evaluate(theme => localStorage.setItem('theme', theme), density.colorScheme)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${density.colorScheme}\\b`))
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    await setTextZoom(page, density.textPercent)

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.scrollWidth, `horizontal overflow at ${label}`).toBeLessThanOrEqual(
      geometry.clientWidth + 1,
    )

    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile Site', exact: true })
    if (await mobileNavigation.isVisible()) {
      const clippedLabels = await mobileNavigation.locator('a').evaluateAll(links => links.flatMap(link => {
        const bounds = link.getBoundingClientRect(), label = link.querySelector('span')
        if (!label) return [{ text: '', reason: 'Missing navigation label' }]
        const range = document.createRange()
        range.selectNodeContents(label)
        const clipped = [...range.getClientRects()].some(rect => rect.left < bounds.left - 1 || rect.right > bounds.right + 1 ||
          rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)
        return clipped || bounds.width < 43.99 || bounds.height < 43.99
          ? [{ text: label.textContent ?? '', reason: 'Label extends beyond its control or target is undersized' }] : []
      }))
      expect(clippedLabels, `mobile navigation at ${label}`).toEqual([])
    }

    const violations = (await new AxeBuilder({ page: page as never }).analyze()).violations
    const { failures, approvedContrastCount } = await inspectAccessibilityViolations(page, violations)
    if (approvedContrastCount) await test.info().attach(`approved-control-contrast-${density.width}`, {
      contentType: 'application/json', body: Buffer.from(JSON.stringify({ density, foreground: '#ffffff', background: '#ff5a00',
        contrast: 3.13, minimumSmallTextContrast: 4.5, count: approvedContrastCount, fullWcagAaCompliance: false })),
    })
    expect(
      failures,
      `axe violations at ${label}`,
    ).toEqual([])

    const undersized = await page.locator(INTERACTIVE).evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) return false
          const style = window.getComputedStyle(element)
          if (style.visibility === 'hidden' || style.display === 'none') return false
          return rect.width < 43.99 || rect.height < 43.99
        })
        .map((element) => element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 60)),
    )
    expect(undersized, `undersized touch targets at ${label}`).toEqual([])

    await setTextZoom(page, 100)
  }
}

/**
 * Keyboard reachability. Focus must enter the page, move through interactive
 * controls in order, stay visible, and never fall back to the document body.
 * A surface reachable only by pointer fails the launch bar.
 */
export async function assertKeyboardReachesTheSurface(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(url)
  await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('body').click({ position: { x: 2, y: 2 } })
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
  })

  const visited: string[] = []
  // Safari's default keyboard setting uses Option-Tab to include every control.
  const tab = page.context().browser()?.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab'
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press(tab)
    const handle = await page.evaluateHandle(() => document.activeElement as HTMLElement | null)
    const inspect = () => page.evaluate((element) => {
      if (!element || element === document.body) return null
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      const points = [[rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + 1, rect.top + 1], [rect.right - 1, rect.bottom - 1]]
      const visible = points.some(([x, y]) => x >= 0 && x < innerWidth && y >= 0 && y < innerHeight &&
        element.contains(document.elementFromPoint(x, y)))
      return {
        tag: element.tagName.toLowerCase(),
        label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '',
        outlined: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
        visible,
        sameControl: document.activeElement === element,
      }
    }, handle)
    const focused = await inspect()
    if (!focused) { await handle.dispose(); continue }
    visited.push(`${focused.tag}:${focused.label}`)
    try {
      await expect.poll(inspect, { message: `focused control must stay visible and outlined on ${focused.tag} "${focused.label}"` })
        .toMatchObject({ sameControl: true, outlined: true, visible: true })
    } finally { await handle.dispose() }
  }

  expect(visited.length, 'no control is reachable by keyboard').toBeGreaterThan(0)
}

/** Portalled navigation sits outside main and needs its own target and focus proof. */
export async function assertSharedNavigationTargets(page: Page, url: string): Promise<void> {
  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(url)
    await page.getByRole('heading', { level: 1 }).waitFor({ state: 'visible' })
    for (const name of ['Open menu', 'Website navigation']) {
      const opener = page.getByRole('button', { name, exact: true })
      if (!await opener.isVisible()) continue
      await opener.focus()
      await page.keyboard.press('Enter')
      const drawer = page.getByRole('dialog')
      await expect(drawer).toBeVisible()
      const close = drawer.getByRole('button', { name: 'Close', exact: true })
      const box = await close.boundingBox()
      expect(box?.width, `drawer close width at ${width}px`).toBeGreaterThanOrEqual(44)
      expect(box?.height, `drawer close height at ${width}px`).toBeGreaterThanOrEqual(44)
      const undersized = await drawer.locator('button,a[href],input:not([type=hidden])').evaluateAll(elements => elements
        .filter(element => { const r = element.getBoundingClientRect(); return r.width && r.height && getComputedStyle(element).visibility !== 'hidden' && (r.width < 43.99 || r.height < 43.99) })
        .map(element => element.getAttribute('aria-label') ?? element.textContent?.trim()))
      expect(undersized, `drawer targets at ${width}px`).toEqual([])
      for (let step = 0; step < 30 && !await close.evaluate(element => element === document.activeElement); step += 1) {
        await page.keyboard.press('Tab')
        expect(await drawer.evaluate(element => element.contains(document.activeElement)), 'drawer retains keyboard focus').toBe(true)
      }
      await expect(close).toBeFocused()
      const indicator = await close.evaluate(element => {
        const style = getComputedStyle(element)
        return style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 && !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.outlineColor))
      })
      expect(indicator, 'drawer close has a visible focus treatment').toBe(true)
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      await expect(opener).toBeFocused()
    }
    const account = page.getByRole('button', { name: 'Account menu', exact: true })
    if (await account.isVisible()) {
      const box = await account.boundingBox()
      expect(box?.width).toBeGreaterThanOrEqual(44)
      expect(box?.height).toBeGreaterThanOrEqual(44)
      await account.focus()
      await page.keyboard.press('Enter')
      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()
      const targets = await menu.getByRole('menuitem').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect()
        return { name: element.textContent?.trim(), width: r.width, height: r.height }
      }))
      expect(targets.length).toBeGreaterThan(0)
      expect(targets.filter(target => target.width < 43.99 || target.height < 43.99), 'account menu targets').toEqual([])
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(account).toBeFocused()
    }
  }
}
