/**
 * Inter Tight: display / marketing headlines + wordmark weight.
 * Inter: product UI and body.
 * JetBrains Mono: scores, grades, caps labels.
 *
 * Font files ship with the application through Fontsource. Keeping the
 * variables here preserves the existing layout contract without making a
 * production build depend on Google Fonts being reachable.
 */
export const fontVariables = 'font-variables'

export const ogFontFamilies = {
  display: 'Inter Tight, Inter, system-ui, sans-serif',
  serif: 'Inter Tight, Inter, system-ui, sans-serif',
  sans: 'Inter, system-ui, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
} as const
