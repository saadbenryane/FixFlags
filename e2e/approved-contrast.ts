import type { Result } from 'axe-core'
import type { Page } from '@playwright/test'

/** Text controls must meet the measured accessibility requirements without brand exceptions. */
export async function inspectAccessibilityViolations(_page: Page, violations: Result[]) {
  const failures = violations.flatMap(violation => violation.nodes.map(node => `${violation.id}: ${node.target.join(' ')}`))
  return { failures, approvedContrastCount: 0 }
}
