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
const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <image href="data:image/svg+xml;base64,${logo}" x="72" y="52" width="184" height="48"/>
  ${textPaths('Website', 68, 242, 88, P.foreground, display)}
  ${textPaths('monitoring.', 68, 334, 88, P.foreground, display)}
  ${textPaths(C.headline[1], 72, 405, 37, P.primary, display)}
  ${textPaths(C.description, 73, 450, 20, P.mutedForeground)}
  ${textPaths(BRAND.domain, 73, 563, 18, P.mutedForeground)}
</svg>`
const jpeg = await sharp('public/marketing/visuals/folded-f-studio-v1.png')
  .resize(1200, 630, { fit: 'cover' })
  .composite([{ input: Buffer.from(overlay) }])
  .jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer()
await writeFile('public/og.jpg', jpeg)
await writeFile('public/og-v2.jpg', jpeg)
await writeFile('app/opengraph-image.jpg', jpeg)
await writeFile('app/opengraph-image.alt.txt', `${BRAND.tagline} ${C.description} Orange glass FixFlags mark on a warm studio background.\n`)
console.log(`Rendered matching 1200x630 social cards (${Math.round(jpeg.length / 1024)} KB each).`)
