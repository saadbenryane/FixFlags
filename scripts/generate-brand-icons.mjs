#!/usr/bin/env node
/**
 * Derives runtime brand assets from owner-supplied originals.
 *
 * The originals are JPEGs on black. JPEG cannot store transparency, so a
 * straight resize keeps the black plate. This script:
 *   1. Applies GIMP-style color-to-alpha against black at native resolution
 *      (anti-aliased edges become partial alpha, not a halo or jaggy cut).
 *   2. Trims empty padding.
 *   3. Contain-resizes onto a transparent canvas for retina UI and icons.
 *
 * Originals stay untouched in docs/brand/reference/.
 * Run: node scripts/generate-brand-icons.mjs
 */
import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const PUBLIC = join(ROOT, 'public')
const BRAND = join(PUBLIC, 'brand')
const SOURCE_MARK = join(ROOT, 'docs/brand/reference/logo-mark-source.jpg')

const MARK_CSS = { sm: 24, md: 28, lg: 32 }
const RETINA = 3

/** sRGB 0–255 → linear 0–1 */
function toLinear(c) {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** linear 0–1 → sRGB 0–255 */
function toSrgb(c) {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(Math.min(255, Math.max(0, s * 255)))
}

/**
 * GIMP / GEGL color-to-alpha for a black key.
 * Edge pixels are orange mixed with black; alpha is the mix amount and the
 * color is un-premultiplied so compositing over white/dark stays clean.
 *
 * transparencyThreshold: JPEG noise near black becomes fully transparent.
 * opacityThreshold: solid orange stays fully opaque (not a see-through fill).
 */
function colorToAlphaBlack(data, { transparencyThreshold = 0.03, opacityThreshold = 0.55 } = {}) {
  const out = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lr = toLinear(r)
    const lg = toLinear(g)
    const lb = toLinear(b)
    let alpha = Math.max(lr, lg, lb)

    if (alpha <= transparencyThreshold) {
      continue
    }

    if (alpha >= opacityThreshold) {
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
      out[i + 3] = 255
      continue
    }

    const t = (alpha - transparencyThreshold) / (opacityThreshold - transparencyThreshold)
    const a = Math.min(1, Math.max(0, t))
    out[i] = toSrgb(lr / alpha)
    out[i + 1] = toSrgb(lg / alpha)
    out[i + 2] = toSrgb(lb / alpha)
    out[i + 3] = Math.round(a * 255)
  }
  return out
}

async function transparentMaster(src) {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const keyed = colorToAlphaBlack(data)
  return sharp(keyed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim()
    .png()
    .toBuffer()
}

async function writeContain(srcBuffer, size, out, { scale = 1 } = {}) {
  const markSize = Math.round(size * scale)
  const mark = await sharp(srcBuffer)
    .resize({
      width: markSize,
      height: markSize,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  const meta = await sharp(mark).metadata()
  const width = meta.width ?? markSize
  const height = meta.height ?? markSize

  await sharp({
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
    .toFile(out)

  console.log(`  wrote ${out.slice(ROOT.length + 1)} (${size}×${size})`)
}

async function main() {
  console.log('Generating transparent brand assets from originals...')

  const master = await transparentMaster(SOURCE_MARK)
  await sharp(master).png().toFile(join(BRAND, 'logo-mark.png'))
  const masterMeta = await sharp(master).metadata()
  console.log(
    `  wrote public/brand/logo-mark.png (${masterMeta.width}×${masterMeta.height}, transparent)`
  )

  for (const [size, cssPx] of Object.entries(MARK_CSS)) {
    await writeContain(master, cssPx * RETINA, join(BRAND, `logo-mark-${size}.png`))
  }

  await writeContain(master, 32, join(PUBLIC, 'icon-32.png'))
  await writeContain(master, 180, join(PUBLIC, 'apple-icon.png'), { scale: 0.86 })
  await writeContain(master, 192, join(PUBLIC, 'icon-192.png'))
  await writeContain(master, 512, join(PUBLIC, 'icon-512.png'))
  await writeContain(master, 512, join(PUBLIC, 'icon-512-maskable.png'), { scale: 0.74 })

  const ico16 = join(PUBLIC, '.favicon-16.png')
  const ico32 = join(PUBLIC, '.favicon-32.png')
  await writeContain(master, 16, ico16, { scale: 0.92 })
  await writeContain(master, 32, ico32, { scale: 0.92 })
  const { default: pngToIco } = await import('png-to-ico')
  writeFileSync(join(PUBLIC, 'favicon.ico'), await pngToIco([ico16, ico32]))
  unlinkSync(ico16)
  unlinkSync(ico32)
  console.log('  wrote public/favicon.ico')

  await sharp(master).png().toFile(join(ROOT, 'prototypes/fixflags-board/public/assets/logo-mark.png'))
  console.log('  wrote prototypes/fixflags-board/public/assets/logo-mark.png')

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
