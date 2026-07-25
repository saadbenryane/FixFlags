import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google'

/**
 * Inter Tight: display / marketing headlines + wordmark weight.
 * Inter: product UI and body.
 * JetBrains Mono: scores, grades, caps labels.
 */
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

/** Inter Tight for display; Inter for UI/body; JetBrains Mono for scores/labels */
export const fontVariables = `${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`

export const ogFontFamilies = {
  display: 'Inter Tight, Inter, system-ui, sans-serif',
  serif: 'Inter Tight, Inter, system-ui, sans-serif',
  sans: 'Inter, system-ui, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
} as const
