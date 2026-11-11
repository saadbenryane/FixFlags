import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import sharp from 'sharp'

test('transparent logo and favicons contain orange artwork without a dark matte', async () => {
  for (const file of ['public/brand/logo-mark-transparent.png', 'public/icon-16.png', 'public/icon-32.png', 'public/icon-48.png', 'public/icon-96.png']) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    assert.equal(data[3], 0, `${file} corner must be transparent`)
    let visible = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] <= 8) continue
      visible++
      assert.ok(data[i] >= 250 && data[i + 1] >= 75 && data[i + 1] <= 110 && data[i + 2] <= 5, `${file} contains a colored or dark fringe`)
    }
    assert.ok(visible > info.width * info.height * .15, `${file} has no usable mark`)
  }
})

test('installation artwork has native resolution, opaque backgrounds, and no dark fringe', async () => {
  for (const [file, size] of [['public/apple-touch-icon-v2.png', 180], ['public/icon-192.png', 192], ['public/icon-512.png', 512], ['public/brand/app-icon-1024.png', 1024]]) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
    assert.equal(info.width, size, file)
    assert.equal(info.height, size, file)
    assert.equal(info.channels, 3, `${file} must be opaque RGB`)
    let markPixels = 0
    for (let i = 0; i < data.length; i += 3) {
      assert.ok(data[i] >= 250, `${file} contains a dark fringe`)
      if (data[i + 1] < 160) markPixels++
    }
    assert.ok(markPixels > size * size * .16, `${file} mark is too small`)
    assert.ok(markPixels < size * size * .3, `${file} mark has no breathing room`)
  }
})

test('maskable artwork stays inside the platform safe circle', async () => {
  const { data, info } = await sharp('public/icon-512-maskable.png').raw().toBuffer({ resolveWithObject: true })
  const center = info.width / 2
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * info.channels + 1] < 200) {
      assert.ok(Math.hypot(x + .5 - center, y + .5 - center) <= info.width * .4, 'mark extends outside the maskable safe area')
    }
  }
})

test('the install manifest offers high-resolution artwork and the favicon has three native sizes', async () => {
  const manifest = JSON.parse(await readFile('public/manifest.webmanifest', 'utf8'))
  for (const icon of manifest.icons) {
    const file = `public${icon.src.split('?')[0]}`
    const metadata = await sharp(file).metadata()
    assert.equal(icon.sizes, `${metadata.width}x${metadata.height}`)
    assert.ok(metadata.width >= 192)
  }
  const ico = await readFile('public/favicon.ico')
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 3)
  assert.deepEqual(Array.from({ length: 3 }, (_, i) => ico[6 + i * 16]).sort((a, b) => a - b), [16, 32, 48])
})

test('all share-card entry points serve the same current artwork', async () => {
  const primary = await readFile('public/og-v3.jpg')
  for (const file of ['public/og.jpg', 'public/og-v2.jpg', 'app/opengraph-image.jpg', 'app/twitter-image.jpg']) assert.deepEqual(await readFile(file), primary)
  assert.equal(await readFile('app/opengraph-image.alt.txt', 'utf8'), await readFile('app/twitter-image.alt.txt', 'utf8'))
  const metadata = await sharp(primary).metadata()
  assert.equal(metadata.width, 1200)
  assert.equal(metadata.height, 630)
})
