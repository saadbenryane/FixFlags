import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const fontModule = require('next/dist/compiled/@next/font/dist/fontkit').default
const parseFont = fontModule.default || fontModule
const { getFallbackMetricsFromFontFile } = require('next/dist/compiled/@next/font/dist/local/get-fallback-metrics-from-font-file')
const fonts = [
  { family: 'Inter Variable Metrics', file: '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2' },
  { family: 'Inter Tight Variable Metrics', file: '@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2' },
]
const css = '/* Generated from the bundled font files. Run npm run font:metrics after changing fonts. */\n' + fonts.map(({ family, file }) => {
  const font = parseFont(fs.readFileSync(require.resolve(file)))
  const metrics = getFallbackMetricsFromFontFile(font, 'sans-serif')
  return `@font-face {\n  font-family: "${family}";\n  src: local("${metrics.fallbackFont}");\n  ascent-override: ${metrics.ascentOverride};\n  descent-override: ${metrics.descentOverride};\n  line-gap-override: ${metrics.lineGapOverride};\n  size-adjust: ${metrics.sizeAdjust};\n}\n`
}).join('\n')
const target = path.resolve('app/font-fallbacks.css')
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== css) throw new Error('Font metrics changed. Run npm run font:metrics and verify layout stability.')
  console.log('Bundled font loading metrics match.')
} else {
  fs.writeFileSync(target, css)
  console.log('Generated bundled font loading metrics.')
}
