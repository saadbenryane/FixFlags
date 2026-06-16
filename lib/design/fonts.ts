import localFont from 'next/font/local'
import { IBM_Plex_Mono } from 'next/font/google'

export const satoshi = localFont({
  src: [
    { path: '../../public/fonts/Satoshi-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/Satoshi-Black.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
})

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

/** Satoshi for display + body; mono for scores/labels */
export const fontVariables = `${satoshi.variable} ${ibmPlexMono.variable}`

export const ogFontFamilies = {
  display: 'Satoshi, system-ui, sans-serif',
  sans: 'Satoshi, system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
} as const
