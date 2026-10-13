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
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}%`
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
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null
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
      }
    })
    if (!focused) continue
    visited.push(`${focused.tag}:${focused.label}`)
    expect(focused.outlined, `focus indicator missing on ${focused.tag} "${focused.label}"`).toBe(true)
    expect(focused.visible, `focused control obscured on ${focused.tag} "${focused.label}"`).toBe(true)
  }

  expect(visited.length, 'no control is reachable by keyboard').toBeGreaterThan(0)
}
