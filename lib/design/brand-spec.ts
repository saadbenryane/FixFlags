import { gradeFromScore } from '@/lib/audit/scoring'

// Hex values for non-CSS consumers (OG, email, manifest). Final Brand Guideline.
// Mesh/orb gradients live in lib/design/tokens.css only.
export const BRAND_HEX = {
  primary: '#FF4B00',
  primaryLight: '#FF7A4D',
  background: '#FAF8F4',
  foreground: '#080808',
  muted: '#EEEAE3',
  mutedForeground: '#6D6A64',
  border: '#E6E1D8',
  success: '#22C55E',
  warning: '#FACC15',
  error: '#FF4444',
  info: '#3B82F6',
} as const

export const BRAND_HEX_DARK = {
  primary: '#FF5C1A',
  primaryLight: '#FF7A4D',
  background: '#111111',
  foreground: '#F5F3EF',
  muted: '#1E1E1E',
  mutedForeground: '#A7A29A',
  border: '#292929',
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
