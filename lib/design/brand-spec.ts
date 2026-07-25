import { gradeFromScore } from '@/lib/audit/scoring'

// Hex values for non-CSS consumers (OG, email, manifest). Brand sheet 2026-07.
// Mesh/orb gradients live in lib/design/tokens.css only.
export const BRAND_HEX = {
  primary: '#FF5A00',
  primaryLight: '#FF7A33',
  primaryDepth: '#C44700',
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
  primary: '#FF5C1A',
  primaryLight: '#FF7A33',
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
