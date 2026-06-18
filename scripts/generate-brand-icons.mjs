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
const BRAND_WHITE = '#FFFFFF'

function markSvg(size) {
  const markSize = Math.round((size / 32) * 28)
  const markOffset = Math.round((size - markSize) / 2)
  const markScale = markSize / 48

  const mark = readFileSync(join(PUBLIC, 'brand/mark-light.svg'), 'utf8')

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(${markOffset}, ${markOffset}) scale(${markScale})">${mark.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
</svg>`
}

function maskableSvg(size) {
  const markSize = Math.round(size * 0.58)
  const markOffset = Math.round((size - markSize) / 2)
  const markScale = markSize / 48
  const mark = readFileSync(join(PUBLIC, 'brand/mark-light.svg'), 'utf8')

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${BRAND_WHITE}"/>
  <g transform="translate(${markOffset}, ${markOffset}) scale(${markScale})">${mark.replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
</svg>`
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
