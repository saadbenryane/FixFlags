import { gradeFromScore } from '@/lib/audit/scoring'

/** Convert HSL components (h 0–360, s/l 0–100) to #rrggbb */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

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

/** Light palette — mirrors :root in tokens.css */
export const brandLight: BrandPalette = {
  background: hslToHex(42, 26, 99),
  foreground: hslToHex(25, 10, 13),
  card: hslToHex(42, 32, 99.5),
  muted: hslToHex(38, 16, 96.5),
  mutedForeground: hslToHex(25, 5, 44),
  brand: hslToHex(28, 45, 38),
  brandForeground: hslToHex(42, 26, 99),
  border: hslToHex(36, 10, 90),
  link: hslToHex(220, 45, 38),
  success: hslToHex(142, 71, 45),
  destructive: hslToHex(0, 72, 51),
  grades: {
    A: hslToHex(142, 71, 45),
    B: hslToHex(84, 81, 44),
    C: hslToHex(28, 45, 38),
    D: hslToHex(25, 95, 53),
    F: hslToHex(0, 84, 60),
  },
}

/** Dark palette — mirrors .dark in tokens.css */
export const brandDark: BrandPalette = {
  background: hslToHex(25, 10, 6),
  foreground: hslToHex(40, 16, 96),
  card: hslToHex(25, 8, 8),
  muted: hslToHex(25, 6, 13),
  mutedForeground: hslToHex(30, 6, 58),
  brand: hslToHex(32, 48, 52),
  brandForeground: hslToHex(25, 10, 8),
  border: hslToHex(25, 6, 15),
  link: hslToHex(215, 55, 68),
  success: hslToHex(142, 70, 45),
  destructive: hslToHex(0, 62, 40),
  grades: {
    A: hslToHex(142, 70, 45),
    B: hslToHex(84, 75, 50),
    C: hslToHex(32, 48, 52),
    D: hslToHex(25, 90, 58),
    F: hslToHex(0, 72, 55),
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

/** PWA manifest colors */
export const manifestColors = {
  background_color: brandLight.background,
  theme_color: brandLight.brand,
} as const
