#!/usr/bin/env node
/**
 * Derives runtime brand assets from owner-supplied originals.
 * Originals stay in docs/brand/reference/. This script only resizes
 * (contain, same proportions). It does not crop, recolor, or key out
 * backgrounds.
 *
 * Run: node scripts/generate-brand-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC = join(ROOT, 'public')
const BRAND = join(PUBLIC, 'brand')
const SOURCE_MARK = join(ROOT, 'docs/brand/reference/logo-mark-source.jpg')
const SOURCE_LOCKUP = join(ROOT, 'docs/brand/reference/logo-lockup-source.jpg')

const MARK_CSS = { sm: 24, md: 28, lg: 32 }
const LOCKUP_CSS = { sm: 24, md: 28, lg: 32 }
const RETINA = 3

async function writeContain(src, width, height, out) {
  await sharp(src)
    .resize(width, height, {
      fit: 'contain',
      withoutEnlargement: false,
    })
    .png()
    .toFile(out)
  console.log(`  wrote ${out.slice(ROOT.length + 1)} (${width}×${height})`)
}

async function main() {
  console.log('Generating brand assets from originals...')

  const markMeta = await sharp(SOURCE_MARK).metadata()
  const lockupMeta = await sharp(SOURCE_LOCKUP).metadata()
  const markW = markMeta.width ?? 1024
  const markH = markMeta.height ?? 1024
  const lockupW = lockupMeta.width ?? 1024
  const lockupH = lockupMeta.height ?? 384
  const lockupRatio = lockupW / lockupH

  await writeContain(SOURCE_MARK, markW, markH, join(BRAND, 'logo-mark.png'))
  await writeContain(SOURCE_LOCKUP, lockupW, lockupH, join(BRAND, 'logo-lockup.png'))
  await writeContain(SOURCE_LOCKUP, lockupW, lockupH, join(BRAND, 'logo-lockup-dark.png'))
  await writeContain(SOURCE_LOCKUP, lockupW, lockupH, join(BRAND, 'logo-lockup-light.png'))

  for (const [size, cssPx] of Object.entries(MARK_CSS)) {
    const px = cssPx * RETINA
    await writeContain(SOURCE_MARK, px, px, join(BRAND, `logo-mark-${size}.png`))
  }

  for (const [size, cssH] of Object.entries(LOCKUP_CSS)) {
    const height = cssH * RETINA
    const width = Math.round(height * lockupRatio)
    await writeContain(SOURCE_LOCKUP, width, height, join(BRAND, `logo-lockup-${size}.png`))
  }

  await writeContain(SOURCE_MARK, 32, 32, join(PUBLIC, 'icon-32.png'))
  await writeContain(SOURCE_MARK, 180, 180, join(PUBLIC, 'apple-icon.png'))
  await writeContain(SOURCE_MARK, 192, 192, join(PUBLIC, 'icon-192.png'))
  await writeContain(SOURCE_MARK, 512, 512, join(PUBLIC, 'icon-512.png'))
  await writeContain(SOURCE_MARK, 512, 512, join(PUBLIC, 'icon-512-maskable.png'))

  const png16 = await sharp(SOURCE_MARK)
    .resize(16, 16, { fit: 'contain' })
    .png()
    .toBuffer()
  const png32 = await sharp(SOURCE_MARK)
    .resize(32, 32, { fit: 'contain' })
    .png()
    .toBuffer()
  const { default: pngToIco } = await import('png-to-ico')
  writeFileSync(join(PUBLIC, 'favicon.ico'), await pngToIco([png16, png32]))
  console.log('  wrote public/favicon.ico')

  const prototypeMark = join(ROOT, 'prototypes/fixflags-board/public/assets/logo-mark.png')
  await writeContain(SOURCE_MARK, markW, markH, prototypeMark)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
