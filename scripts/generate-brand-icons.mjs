#!/usr/bin/env node
/** Render the owner mark from its cleaned vector master, never from a resized JPEG. */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const fontModule = require('next/dist/compiled/@next/font/dist/fontkit').default
const parseFont = fontModule.default || fontModule
const primary = '#FF5A00'
const ink = '#0B0B0D'
const white = '#FFFFFF'
const mark = await readFile('public/brand/logo-mark.svg', 'utf8')
const markPaths = mark.match(/<path[^>]+\/>/g).join('')
const bold = parseFont(await readFile('scripts/assets/fonts/InterTight-Bold.ttf'))
const semibold = parseFont(await readFile('scripts/assets/fonts/InterTight-SemiBold.ttf'))

function textPaths(text, font, x, baseline, size, color) {
  const scale = size / font.unitsPerEm
  const run = font.layout(text)
  let pen = x
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index]
    const path = `<path d="${glyph.path.toSVG()}" transform="translate(${pen + position.xOffset * scale} ${baseline - position.yOffset * scale}) scale(${scale} ${-scale})" fill="${color}"/>`
    pen += position.xAdvance * scale
    return path
  }).join('')
  return { paths, end: pen }
}

function markAt(x, y, height) {
  return `<g fill="${primary}" transform="translate(${x} ${y}) scale(${height / 779})">${markPaths}</g>`
}

async function icon(size, path, { background = 'transparent', scale = .74 } = {}) {
  const height = size * scale
  const width = height * 474 / 779
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${background !== 'transparent' ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}${markAt((size - width) / 2, (size - height) / 2, height)}</svg>`
  // Rasterize the paths at each target's native resolution. No bitmap enlargement.
  let raster = sharp(Buffer.from(svg), { density: 288 }).resize(size, size)
  if (background !== 'transparent') raster = raster.flatten({ background })
  await raster.png().toFile(path)
}

await sharp(Buffer.from(mark), { density: 288 }).resize({ height: 2048 }).png().toFile('public/brand/logo-mark.png')
for (const [name, display] of Object.entries({ sm: 24, md: 28, lg: 32 })) {
  await icon(display * 3, `public/brand/logo-mark-${name}.png`, { scale: 1 })
}

for (const size of [16, 32, 48]) await icon(size, `public/icon-${size}.png`, { scale: .94 })
await writeFile('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${markAt((32 - 30 * 474 / 779) / 2, 1, 30)}</svg>`)
for (const size of [192, 512]) await icon(size, `public/icon-${size}.png`, { background: white })
await icon(512, 'public/icon-512-maskable.png', { background: white, scale: .66 })
await icon(180, 'public/apple-icon.png', { background: white })
await icon(180, 'public/apple-touch-icon-v2.png', { background: white })
await icon(1024, 'public/brand/app-icon-1024.png', { background: white })
const { default: pngToIco } = await import('png-to-ico')
await writeFile('public/favicon.ico', await pngToIco(['public/icon-16.png', 'public/icon-32.png', 'public/icon-48.png']))

for (const [theme, color] of [['light', ink], ['dark', white]]) {
  const fix = textPaths('Fix', bold, 94, 94, 96, color)
  const flags = textPaths('Flags', semibold, fix.end, 94, 96, color)
  const width = Math.ceil(flags.end + 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 120" role="img" aria-label="FixFlags">${markAt(0, 0, 120)}${fix.paths}${flags.paths}</svg>`
  await writeFile(`public/brand/logo-lockup-${theme}.svg`, svg)
  await writeFile(`public/brand/wordmark-${theme}.svg`, svg)
  await sharp(Buffer.from(svg), { density: 288 }).resize({ width: 1600 }).png().toFile(`public/brand/logo-lockup-${theme}.png`)
}

await mkdir('prototypes/fixflags-board/public/assets', { recursive: true })
await sharp(Buffer.from(mark), { density: 144 }).png().toFile('prototypes/fixflags-board/public/assets/logo-mark.png')
console.log('Rendered clean vector-derived logos, 16/32/48 favicons, opaque home-screen icons, and maskable artwork.')
