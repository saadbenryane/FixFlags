import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'
import type { Result } from 'axe-core'
import { inspectAccessibilityViolations } from '../../../e2e/approved-contrast'
import { BRAND_HEX } from '@/lib/design/brand-spec'

const violation = (id: string, data: Record<string, unknown> = {}) => ({
  id, nodes: [{ target: ['button'], any: [{ id: 'color-contrast', data }] }],
}) as unknown as Result
const approved = { fgColor: BRAND_HEX.background, bgColor: BRAND_HEX.primary, contrastRatio: 3.13 }

function page(isControl: boolean) {
  return { locator: vi.fn(() => ({ evaluate: vi.fn(async () => isControl) })) } as unknown as Page
}

describe('release accessibility exception', () => {
  it('approves only the measured orange control contrast', async () => {
    expect(await inspectAccessibilityViolations(page(true), [violation('color-contrast', approved)]))
      .toEqual({ failures: [], approvedContrastCount: 1 })
  })
  it('rejects other colors, text, ARIA errors and missing measurements', async () => {
    for (const row of [violation('color-contrast', { ...approved, bgColor: BRAND_HEX.mutedForeground }),
      violation('color-contrast', { ...approved, contrastRatio: 2 }), violation('aria-prohibited-attr'), violation('color-contrast')]) {
      const result = await inspectAccessibilityViolations(page(true), [row])
      expect(result.failures).toHaveLength(1)
      expect(result.approvedContrastCount).toBe(0)
    }
    expect((await inspectAccessibilityViolations(page(false), [violation('color-contrast', approved)])).failures).toHaveLength(1)
  })
  it('does not suppress another failing node in the same violation', async () => {
    const allowed = violation('color-contrast', approved)
    allowed.nodes.push(violation('color-contrast', { ...approved, fgColor: BRAND_HEX.gray200 }).nodes[0])
    expect(await inspectAccessibilityViolations(page(true), [allowed])).toEqual({ failures: ['color-contrast: button'], approvedContrastCount: 1 })
  })
})
