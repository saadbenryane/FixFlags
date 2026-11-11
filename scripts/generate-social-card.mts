import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { BRAND_HEX as P } from '../lib/design/brand-spec'
import { BRAND, SOCIAL_CARD as C } from '../lib/marketing/copy/brand'

// Generated photography supplies the material. Brand assets and text stay exact.
// Run from the repository root with: npx tsx scripts/generate-social-card.mts
const require = createRequire(import.meta.url)
const fontModule = require('next/dist/compiled/@next/font/dist/fontkit').default
const parseFont = fontModule.default || fontModule
const display = parseFont(await readFile('scripts/assets/fonts/InterTight-SemiBold.ttf'))
const body = parseFont(await readFile(require.resolve('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')))

function textPaths(text: string, x: number, y: number, size: number, color: string, font = body) {
  const scale = size / font.unitsPerEm
  const run = font.layout(text)
  let pen = x
  return run.glyphs.map((glyph: { path: { toSVG(): string } }, index: number) => {
    const position = run.positions[index]
    const path = `<path d="${glyph.path.toSVG()}" transform="translate(${pen + position.xOffset * scale} ${y - position.yOffset * scale}) scale(${scale} ${-scale})" fill="${color}"/>`
    pen += position.xAdvance * scale
    return path
  }).join('')
}

const logo = (await readFile('public/brand/logo-lockup-light.svg')).toString('base64')
const headlineSize = 62
const closingLine = C.headline[1].replace(/\.$/, '')
const closingWidth = display.layout(closingLine).positions.reduce((sum: number, position: { xAdvance: number }) => sum + position.xAdvance, 0) * headlineSize / display.unitsPerEm
const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <image href="data:image/svg+xml;base64,${logo}" x="64" y="52" width="168" height="44"/>
  ${textPaths(C.headline[0], 60, 266, headlineSize, P.foreground, display)}
  ${textPaths(closingLine, 60, 338, headlineSize, P.foreground, display)}
  ${textPaths('.', 60 + closingWidth, 338, headlineSize, P.primary, display)}
  ${textPaths(C.description, 64, 401, 20, P.mutedForeground)}
  <circle cx="68" cy="468" r="4" fill="${P.primary}"/>
  ${textPaths(C.label, 84, 474, 17, P.foreground)}
  ${textPaths(BRAND.domain, 64, 566, 17, P.mutedForeground)}
</svg>`
const jpeg = await sharp('public/marketing/visuals/social-studio-v3.webp')
  .resize(1200, 630, { fit: 'cover' })
  .composite([{ input: Buffer.from(overlay) }])
  .jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer()
for (const file of ['public/og.jpg', 'public/og-v2.jpg', 'public/og-v3.jpg', 'app/opengraph-image.jpg', 'app/twitter-image.jpg']) {
  await writeFile(file, jpeg)
}
for (const file of ['app/opengraph-image.alt.txt', 'app/twitter-image.alt.txt']) {
  await writeFile(file, `${C.imageAlt}\n`)
}
console.log(`Rendered matching 1200x630 social cards (${Math.round(jpeg.length / 1024)} KB each).`)
