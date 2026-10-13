import type { Result } from 'axe-core'
import type { Page } from '@playwright/test'

/** Only the owner's measured white-on-orange control exception is approved. */
export async function inspectAccessibilityViolations(page: Page, violations: Result[]) {
  const failures: string[] = []
  let approvedContrastCount = 0
  for (const violation of violations) for (const node of violation.nodes) {
    const measuredException = violation.id === 'color-contrast' && node.any.some(check =>
      check.id === 'color-contrast' && check.data?.fgColor?.toLowerCase() === '#ffffff' &&
      check.data?.bgColor?.toLowerCase() === '#ff5a00' && check.data?.contrastRatio >= 3.12 && check.data?.contrastRatio <= 3.14)
    const selector = node.target.length === 1 && typeof node.target[0] === 'string' ? node.target[0] : null
    const control = measuredException && selector ? await page.locator(selector).evaluate(element => {
      const button = element.closest('button, a[href]')
      if (!button) return false
      const style = getComputedStyle(button), rect = button.getBoundingClientRect()
      return style.backgroundColor === 'rgb(255, 90, 0)' && rect.height >= 43.99 &&
        (button.tagName === 'BUTTON' || ['inline-flex', 'flex'].includes(style.display))
    }).catch(() => false) : false
    if (control) approvedContrastCount++
    else failures.push(`${violation.id}: ${node.target.join(' ')}`)
  }
  return { failures, approvedContrastCount }
}
