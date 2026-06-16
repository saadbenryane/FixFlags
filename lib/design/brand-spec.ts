import { gradeFromScore } from '@/lib/audit/scoring'

export const BRAND_HEX = {
  primary: '#FF4D1F',
  primaryLight: '#FF744D',
  background: '#FFFFFF',
  foreground: '#0F1115',
  muted: '#F3F4F6',
  mutedForeground: '#5B7380',
  border: '#E5E7EB',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#EF4444',
  info: '#3B82F6',
} as const

export const BRAND_HEX_DARK = {
  primary: '#FF4D1F',
  primaryLight: '#FF744D',
  background: '#0F1115',
  foreground: '#FFFFFF',
  muted: '#2A2F3A',
  mutedForeground: '#8B9BAA',
  border: '#1C1F26',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#EF4444',
  info: '#3B82F6',
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
  card: BRAND_HEX.background,
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
  card: BRAND_HEX_DARK.border,
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
