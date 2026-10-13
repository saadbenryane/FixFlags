import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { describe, expect, it } from 'vitest'
import config from '../../../tailwind.config'
import { brandDark, brandLight, manifestColors } from '@/lib/design/brand-spec'

const tokens = postcss.parse(['lib/design/tokens.css', 'app/globals.css']
  .map(file => readFileSync(resolve(file), 'utf8')).join('\n'))

function themeValues(dark: boolean) {
  const values = new Map<string, string>()
  tokens.walkRules(rule => {
    if (rule.selectors.includes(':root') || (dark && rule.selector === '.dark')) {
      rule.walkDecls(declaration => { values.set(declaration.prop, declaration.value) })
    }
  })
  return values
}

function hslHex(value: string) {
  const [hue, saturation, lightness] = value.split(/\s+/).map(Number.parseFloat)
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase()
}

function resolveVariables(value: string, values: Map<string, string>): string {
  return value.replace(/var\((--[\w-]+)(?:,([^)]*))?\)/g, (_, name: string, fallback: string | undefined) => {
    const replacement = values.get(name) ?? fallback
    expect(replacement, `Undefined token ${name}`).toBeDefined()
    return resolveVariables(replacement!, values)
  })
}

function contrast(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(offset => {
      const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('shared design contract', () => {
  it.each([false, true])('keeps CSS and non-CSS brand identity aligned (dark: %s)', dark => {
    const values = themeValues(dark)
    const brand = dark ? brandDark : brandLight
    expect(hslHex(values.get('--brand')!)).toBe(brand.brand)
    expect(hslHex(values.get('--brand-foreground')!)).toBe(brandLight.background)
    expect(brand.brandForeground).toBe(brandLight.background)
    expect(manifestColors.theme_color).toBe(brandLight.brand)
    expect(hslHex(values.get('--logo-tile-background')!)).toBe(brandLight.background)
    expect(hslHex(values.get('--link')!)).toBe(brand.link)
    const destructiveFill = hslHex(resolveVariables(values.get('--destructive-control')!, values))
    const destructiveLabel = hslHex(resolveVariables(values.get('--destructive-foreground')!, values))
    expect(contrast(destructiveLabel, destructiveFill)).toBeGreaterThanOrEqual(4.5)
    for (const surface of [brand.background, brand.card]) {
      expect(contrast(brand.link, surface)).toBeGreaterThanOrEqual(4.5)
      const strong = hslHex(resolveVariables(values.get('--brand-strong')!, values))
      expect(contrast(strong, surface)).toBeGreaterThanOrEqual(4.5)
    }
    // The explicitly approved control exception must remain precisely documented.
    expect(contrast(brand.brandForeground, brand.brand)).toBeGreaterThanOrEqual(3.12)
    expect(contrast(brand.brandForeground, brand.brand)).toBeLessThanOrEqual(3.14)
  })

  it('generates resolvable semantic styles in both themes without changing board geometry or layers', async () => {
    const utilities = await postcss([tailwindcss({
      ...config,
      content: [{ raw: 'bg-info-muted border-info-border bg-brand text-brand-foreground rounded-board-card rounded-board-panel rounded-control font-display z-background z-content z-skip-link z-navbar z-fab z-overlay z-dropdown z-modal z-tooltip', extension: 'html' }],
    })]).process('@tailwind utilities;', { from: undefined })
    const layers: Record<string, string> = {
      background: '-1', content: '10', 'skip-link': '100', navbar: '50',
      fab: '60', overlay: '70', dropdown: '100', modal: '200', tooltip: '300',
    }
    for (const dark of [false, true]) {
      const values = themeValues(dark)
      const generated = new Map<string, Map<string, string>>()
      utilities.root.walkRules(rule => {
        const declarations = new Map<string, string>()
        rule.walkDecls(declaration => {
          values.set(declaration.prop, declaration.value)
          declarations.set(declaration.prop, resolveVariables(declaration.value, values))
        })
        generated.set(rule.selector, declarations)
      })
      expect(generated.get('.rounded-board-card')?.get('border-radius')).toBe('13px')
      expect(generated.get('.rounded-board-panel')?.get('border-radius')).toBe('12px')
      expect(generated.get('.rounded-control')?.get('border-radius')).toBe('0.625rem')
      expect(generated.get('.bg-info-muted')?.get('background-color')).toContain(values.get('--info-muted'))
      expect(generated.get('.border-info-border')?.get('border-color')).toContain(values.get('--info-border'))
      expect(generated.get('.font-display')?.get('font-family')).toContain('Inter Tight Variable')
      for (const [layer, expected] of Object.entries(layers)) {
        expect(generated.get(`.z-${layer}`)?.get('z-index')).toBe(expected)
      }
    }
  })
})
