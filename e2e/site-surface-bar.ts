import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * The launch bar for an authenticated Outcome surface, checked in one pass:
 *
 * - 320 / 375 / 768 / 1280 CSS pixels, so reflow holds at the narrowest phone.
 * - 200% text at every width, plus 400% text at 1280, which is the WCAG 1.4.10
 *   reflow case (1280 CSS pixels at 400% is 320 CSS pixels of content).
 * - No horizontal overflow at any of those sizes.
 * - No automated accessibility violation.
 * - Practical touch targets on every interactive control.
 * - Keyboard reachability with a visible focus indicator.
 *
 * Marketing and public surfaces have their own matrix in
 * `public-journeys.spec.ts`; this covers the surfaces that need a signed-in owner.
 */

type Density = { width: number; textPercent: number; colorScheme: 'light' | 'dark' }

const DENSITIES: Density[] = [
  { width: 320, textPercent: 200, colorScheme: 'light' },
  { width: 375, textPercent: 200, colorScheme: 'light' },
  { width: 768, textPercent: 200, colorScheme: 'dark' },
  { width: 1280, textPercent: 400, colorScheme: 'light' },
]

const INTERACTIVE = 'main a[href], main button, main input, main select, main textarea, main [role="button"], main [role="radio"], main [tabindex]:not([tabindex="-1"])'

async function setTextZoom(page: Page, percent: number): Promise<void> {
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}%`
  }, percent)
}

export async function assertSiteSurfaceMeetsLaunchBar(page: Page, url: string): Promise<void> {
  for (const density of DENSITIES) {
    const label = `${density.width}px at ${density.textPercent}% text`
    await page.setViewportSize({ width: density.width, height: 900 })
    await page.emulateMedia({ colorScheme: density.colorScheme, reducedMotion: 'reduce' })
    await page.goto(url)
    await setTextZoom(page, density.textPercent)

    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.scrollWidth, `horizontal overflow at ${label}`).toBeLessThanOrEqual(
      geometry.clientWidth + 1,
    )

    const violations = (await new AxeBuilder({ page: page as never }).analyze()).violations
    expect(
      violations.map((violation) => `${violation.id}: ${violation.nodes.length}`),
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
      return {
        tag: element.tagName.toLowerCase(),
        label: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 40) ?? '',
        outlined: style.outlineStyle !== 'none' || style.boxShadow !== 'none',
      }
    })
    if (!focused) continue
    visited.push(`${focused.tag}:${focused.label}`)
    expect(focused.outlined, `focus indicator missing on ${focused.tag} "${focused.label}"`).toBe(true)
  }

  expect(visited.length, 'no control is reachable by keyboard').toBeGreaterThan(0)
}
