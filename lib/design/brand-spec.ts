import { gradeFromScore } from '@/lib/audit/scoring'

// Hex values for non-CSS consumers (OG, email, manifest). UI Kit v3.0.
// Mesh/orb gradients live in lib/design/tokens.css only.
export const BRAND_HEX = {
  primary: '#FF4D1F',
  primaryLight: '#FF744D',
  background: '#FFFFFF',
  foreground: '#0F1115',
  muted: '#F3F4F6',
  mutedForeground: '#687380',
  border: '#E5E7EB',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#FF4444',
  info: '#3B82F6',
} as const

export const BRAND_HEX_DARK = {
  primary: '#FF4D1F',
  primaryLight: '#FF744D',
  background: '#0F1115',
  foreground: '#FFFFFF',
  muted: '#2A2D33',
  mutedForeground: '#A3A7AE',
  border: '#1E1F23',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#FF4444',
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
