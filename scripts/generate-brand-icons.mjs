#!/usr/bin/env node
/**
 * Generates brand-aligned static icons in public/ from the official mark SVG.
 * Run: node scripts/generate-brand-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC = join(ROOT, 'public')
const BRAND_BACKGROUND = '#FAF8F4'
const BRAND_BORDER = '#E6E1D8'

function iconSvg(size, { maskable = false } = {}) {
  const markSize = Math.round(size * (maskable ? 0.58 : 0.68))
  const markOffset = Math.round((size - markSize) / 2)
  const markScale = markSize / 48
  const radius = maskable ? 0 : Math.round(size * 0.22)
  const strokeWidth = maskable ? 0 : Math.max(1, Math.round(size * 0.02))

  const mark = readFileSync(join(PUBLIC, 'brand/mark-light.svg'), 'utf8')

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${size - strokeWidth}" height="${size - strokeWidth}" rx="${radius}" fill="${BRAND_BACKGROUND}"${strokeWidth ? ` stroke="${BRAND_BORDER}" stroke-width="${strokeWidth}"` : ''}/>
  <g transform="translate(${markOffset}, ${markOffset}) scale(${markScale})">${mark.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
</svg>`
}

function markSvg(size) {
  return iconSvg(size)
}

function maskableSvg(size) {
  return iconSvg(size, { maskable: true })
}

async function writePng(size, filename, svg = markSvg(size)) {
  const out = join(PUBLIC, filename)
  await sharp(Buffer.from(svg)).png().toFile(out)
  console.log(`  wrote ${filename}`)
}

async function writeFaviconIco() {
  const png16 = await sharp(Buffer.from(markSvg(16))).png().toBuffer()
  const png32 = await sharp(Buffer.from(markSvg(32))).png().toBuffer()

  const { default: pngToIco } = await import('png-to-ico')
  const ico = await pngToIco([png16, png32])
  writeFileSync(join(PUBLIC, 'favicon.ico'), ico)
  console.log('  wrote favicon.ico')
}

async function main() {
  console.log('Generating brand icons...')
  await writePng(192, 'icon-192.png')
  await writePng(512, 'icon-512.png')
  await writePng(512, 'icon-512-maskable.png', maskableSvg(512))
  await writeFaviconIco()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
