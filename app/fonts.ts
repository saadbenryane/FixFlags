import localFont from 'next/font/local'

// Preload the same bundled Latin faces used by the product. Fontsource's
// remaining ranges preserve the existing typography for other scripts.
export const bodyFont = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  fallback: ['Inter Variable Metrics', 'Inter Variable', 'sans-serif'],
})

export const displayFont = localFont({
  src: '../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2',
  variable: '--font-inter-tight',
  weight: '100 900',
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  fallback: ['Inter Tight Variable Metrics', 'Inter Tight Variable', 'sans-serif'],
})
