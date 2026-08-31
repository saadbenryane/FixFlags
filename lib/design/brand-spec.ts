import { gradeFromScore } from '@/lib/audit/scoring'

// Hex values for non-CSS consumers (OG, email, manifest). Brand sheet 2026-07.
// Mesh/orb gradients live in lib/design/tokens.css only.
export const BRAND_HEX = {
  primary: '#C24400',
  primaryLight: '#CC4A00',
  primaryDepth: '#A33800',
  background: '#FFFFFF',
  foreground: '#0B0B0D',
  muted: '#F5F6F7',
  mutedForeground: '#61646B',
  border: '#E6E6E8',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#FF4444',
  info: '#3B82F6',
  gray200: '#E6E6E8',
  gray400: '#A7A8B2',
  gray600: '#61646B',
  gray800: '#1D2024',
  stone: '#F5F6F7',
} as const

export const BRAND_HEX_DARK = {
  primary: '#C23A00',
  primaryLight: '#CC4A00',
  background: '#0B0B0D',
  foreground: '#F5F6F7',
  muted: '#1D2024',
  mutedForeground: '#A7A8B2',
  border: '#2A2C30',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#FF4444',
  info: '#3B82F6',
  gray200: '#2A2C30',
  gray400: '#61646B',
  gray600: '#A7A8B2',
  gray800: '#E6E6E8',
  stone: '#1D2024',
} as const

export type GradeLetter = 'A' | 'B' | 'C' | 'D' | 'F'

export type BrandPalette = {
  background: string
  foreground: string
  card: string
  muted: string
  mutedForeground: string
  brand: string
  brandForeground: string
  border: string
  link: string
  success: string
  destructive: string
  grades: Record<GradeLetter, string>
}

export const brandLight: BrandPalette = {
  background: BRAND_HEX.background,
  foreground: BRAND_HEX.foreground,
  card: BRAND_HEX.muted,
  muted: BRAND_HEX.muted,
  mutedForeground: BRAND_HEX.mutedForeground,
  brand: BRAND_HEX.primary,
  brandForeground: '#FFFFFF',
  border: BRAND_HEX.border,
  link: BRAND_HEX.info,
  success: BRAND_HEX.success,
  destructive: BRAND_HEX.error,
  grades: {
    A: BRAND_HEX.success,
    B: '#84CC16',
    C: BRAND_HEX.primary,
    D: '#F97316',
    F: BRAND_HEX.error,
  },
}

export const brandDark: BrandPalette = {
  background: BRAND_HEX_DARK.background,
  foreground: BRAND_HEX_DARK.foreground,
  card: BRAND_HEX_DARK.muted,
  muted: BRAND_HEX_DARK.muted,
  mutedForeground: BRAND_HEX_DARK.mutedForeground,
  brand: BRAND_HEX_DARK.primary,
  brandForeground: '#FFFFFF',
  border: BRAND_HEX_DARK.border,
  link: BRAND_HEX_DARK.info,
  success: BRAND_HEX_DARK.success,
  destructive: BRAND_HEX_DARK.error,
  grades: {
    A: BRAND_HEX_DARK.success,
    B: '#A3E635',
    C: BRAND_HEX_DARK.primary,
    D: '#FB923C',
    F: BRAND_HEX_DARK.error,
  },
}

export type BrandMode = 'light' | 'dark'

export function getBrandPalette(mode: BrandMode = 'light'): BrandPalette {
  return mode === 'dark' ? brandDark : brandLight
}

export function gradeColorHex(grade: string, mode: BrandMode = 'light'): string {
  const palette = getBrandPalette(mode)
  const key = grade.toUpperCase() as GradeLetter
  return palette.grades[key] ?? palette.mutedForeground
}

export function scoreColorHex(score: number, mode: BrandMode = 'light'): string {
  return gradeColorHex(gradeFromScore(score), mode)
}

export const manifestColors = {
  background_color: brandLight.background,
  theme_color: brandLight.brand,
} as const

function channelLuminance(channel: number): number {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '')
  const normalized = raw.length === 3
    ? raw.split('').map((part) => `${part}${part}`).join('')
    : raw
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  )
}

export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  const lighter = Math.max(first, second)
  const darker = Math.min(first, second)
  return (lighter + 0.05) / (darker + 0.05)
}
