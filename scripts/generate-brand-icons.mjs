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
const BRAND_ORANGE = '#FF4D1F'
const MARK_WHITE = '#FFFFFF'

function iconSvg(size) {
  const borderRadius = Math.round((size / 32) * 8)
  const markScale = size / 32
  const markSize = Math.round(24 * markScale)
  const markOffset = Math.round((size - markSize) / 2)

  const mark = readFileSync(join(PUBLIC, 'brand/mark-light.svg'), 'utf8')
    .replace(/#0F1115/gi, MARK_WHITE)
    .replace(/#FF4D1F/gi, MARK_WHITE)
    .replace(/width="48"/, `width="${markSize}"`)
    .replace(/height="48"/, `height="${markSize}"`)

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${borderRadius}" fill="${BRAND_ORANGE}"/>
  <g transform="translate(${markOffset}, ${markOffset})">${mark.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
</svg>`
}

async function writePng(size, filename) {
  const out = join(PUBLIC, filename)
  await sharp(Buffer.from(iconSvg(size))).png().toFile(out)
  console.log(`  wrote ${filename}`)
}

async function writeFaviconIco() {
  const png16 = await sharp(Buffer.from(iconSvg(16))).png().toBuffer()
  const png32 = await sharp(Buffer.from(iconSvg(32))).png().toBuffer()

  const { default: pngToIco } = await import('png-to-ico')
  const ico = await pngToIco([png16, png32])
  writeFileSync(join(PUBLIC, 'favicon.ico'), ico)
  console.log('  wrote favicon.ico')
}

async function main() {
  console.log('Generating brand icons...')
  await writePng(192, 'icon-192.png')
  await writePng(512, 'icon-512.png')
  await writePng(512, 'icon-512-maskable.png')
  await writeFaviconIco()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
