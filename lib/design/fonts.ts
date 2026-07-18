import localFont from 'next/font/local'
import { IBM_Plex_Mono, Fraunces } from 'next/font/google'

export const satoshi = localFont({
  src: [
    { path: '../../public/fonts/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

/**
 * Fraunces: editorial serif for headlines + wordmark. Free, high-quality
 * stand-in for Canela per the brand guideline. Soft optical setting; used at
 * medium/semibold weights for display type only. UI/body stays on Satoshi.
 * Weights trimmed to what display type actually uses (font-medium / font-semibold).
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal'],
  variable: '--font-serif',
  display: 'optional',
})

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

/** Fraunces serif for display; Satoshi for UI/body; mono for scores/labels */
export const fontVariables = `${satoshi.variable} ${fraunces.variable} ${ibmPlexMono.variable}`

export const ogFontFamilies = {
  display: 'Fraunces, Georgia, serif',
  serif: 'Fraunces, Georgia, serif',
  sans: 'Satoshi, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
} as const
