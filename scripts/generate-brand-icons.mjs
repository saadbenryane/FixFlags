#!/usr/bin/env node
/**
 * Generates brand-aligned static icons in public/ from the official logo asset.
 * Run: node scripts/generate-brand-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC = join(ROOT, 'public')
const LOGO_LOCKUP = join(PUBLIC, 'brand/logo-lockup-light.png')
const FLAG_CROP = { left: 0, top: 0, width: 330, height: 381 }

async function markPng(size, scale = 0.9) {
  const maxMarkSize = Math.round(size * scale)
  const croppedMark = await sharp(LOGO_LOCKUP)
    .extract(FLAG_CROP)
    .png()
    .toBuffer()
  const mark = await sharp(croppedMark)
    .trim()
    .resize({
      width: maxMarkSize,
      height: maxMarkSize,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  const metadata = await sharp(mark).metadata()
  const width = metadata.width ?? maxMarkSize
  const height = metadata.height ?? maxMarkSize

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: mark,
        left: Math.round((size - width) / 2),
        top: Math.round((size - height) / 2),
      },
    ])
    .png()
    .toBuffer()
}

async function writePng(size, filename, scale = 0.9) {
  const out = join(PUBLIC, filename)
  await sharp(await markPng(size, scale)).toFile(out)
  console.log(`  wrote ${filename}`)
}

async function writeFaviconIco() {
  const png16 = await markPng(16, 0.92)
  const png32 = await markPng(32, 0.92)

  const { default: pngToIco } = await import('png-to-ico')
  const ico = await pngToIco([png16, png32])
  writeFileSync(join(PUBLIC, 'favicon.ico'), ico)
  console.log('  wrote favicon.ico')
}

async function main() {
  console.log('Generating brand icons...')
  await writePng(192, 'icon-192.png')
  await writePng(512, 'icon-512.png')
  await writePng(512, 'icon-512-maskable.png', 0.74)
  await writeFaviconIco()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
