import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google'

export const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

/** Class string for <body> — swap fonts here during rebrand */
export const fontVariables = `${sourceSans.variable} ${fraunces.variable} ${ibmPlexMono.variable}`

/** Font family names for OG ImageResponse (no CSS vars) */
export const ogFontFamilies = {
  display: 'Georgia, serif',
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
} as const
