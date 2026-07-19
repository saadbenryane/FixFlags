/**
 * GIF compositor. Composes frame sequences into animated GIFs using omggif.
 */
import sharp from 'sharp'
import { GifEncoder } from 'omggif'
import { logger } from '@/lib/logger'

export interface GifComposeOptions {
  delayMs?: number
  loops?: number
  width?: number
  height?: number
  quality?: number
}

export interface GifFrame {
  buffer: Buffer
  delayMs?: number
}

export interface GifResult {
  buffer: Buffer
  width: number
  height: number
  frameCount: number
}

export async function composeGif(
  frames: GifFrame[],
  options?: GifComposeOptions
): Promise<GifResult | null> {
  if (frames.length === 0) return null

  const { delayMs = 500, loops = 0, width = 640, quality = 10 } = options ?? {}

  const processed: Array<{ data: Buffer; width: number; height: number; delay: number }> = []

  for (const frame of frames) {
    try {
      const meta = await sharp(frame.buffer).metadata()
      const fw = meta.width ?? width
      const fh = meta.height ?? Math.round(fw * 0.75)

      const resized = await sharp(frame.buffer)
        .resize(fw, fh)
        .ensureAlpha()
        .raw()
        .toBuffer()

      processed.push({ data: resized, width: fw, height: fh, delay: frame.delayMs ?? delayMs })
    } catch (err) {
      logger.error('Failed to process GIF frame', err)
    }
  }

  if (processed.length === 0) return null

  const gifW = processed[0].width
  const gifH = processed[0].height

  const encoder = new GifEncoder(gifW, gifH)
  encoder.setDelay(delayMs)
  encoder.setRepeat(loops)
  encoder.setQuality(quality)
  encoder.setTransparent(null)
  encoder.writeHeader()

  for (const frame of processed) {
    encoder.setDelay(frame.delay)
    const { indexedData } = quantizeFrame(frame.data, frame.width, frame.height)
    encoder.addFrame(indexedData)
  }

  encoder.finish()

  return { buffer: Buffer.from(encoder.out.getData()), width: gifW, height: gifH, frameCount: processed.length }
}

function quantizeFrame(
  rgba: Buffer, width: number, height: number
): { indexedData: Uint8Array; colorTable: Array<[number, number, number]> } {
  const pixelCount = width * height
  const colorMap = new Map<number, number>()

  for (let i = 0; i < rgba.length; i += 4) {
    const key = ((rgba[i] >> 2) << 12) | ((rgba[i + 1] >> 2) << 6) | (rgba[i + 2] >> 2)
    colorMap.set(key, (colorMap.get(key) ?? 0) + 1)
  }

  const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256)
  const colorTable: Array<[number, number, number]> = sorted.map(([k]) => [
    ((k >> 12) & 0x3f) << 2, ((k >> 6) & 0x3f) << 2, (k & 0x3f) << 2,
  ])
  while (colorTable.length < 256) colorTable.push([0, 0, 0])

  const lookup = new Map<number, number>()
  sorted.forEach(([k], i) => lookup.set(k, i))

  const indexedData = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    if (rgba[off + 3] < 128) { indexedData[i] = 0; continue }
    const key = ((rgba[off] >> 2) << 12) | ((rgba[off + 1] >> 2) << 6) | (rgba[off + 2] >> 2)
    indexedData[i] = lookup.get(key) ?? 0
  }

  return { indexedData, colorTable }
}

export async function addTimerToFrame(frameBuffer: Buffer, elapsedMs: number): Promise<Buffer> {
  const sec = (elapsedMs / 1000).toFixed(1)
  const svg = `<svg width="80" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="80" height="28" fill="rgba(0,0,0,0.75)" rx="6"/>
    <text x="40" y="20" text-anchor="middle" fill="white" font-size="14" font-weight="bold" font-family="monospace">${sec}s</text>
  </svg>`
  return sharp(frameBuffer).composite([{ input: Buffer.from(svg), top: 8, left: 8 }]).png().toBuffer()
}

export async function addBadgeToFrame(
  frameBuffer: Buffer, text: string, color: 'red' | 'amber' | 'green' = 'red'
): Promise<Buffer> {
  const colors = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' }
  const tw = text.length * 9 + 24
  const svg = `<svg width="${tw}" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${tw}" height="28" fill="${colors[color]}" rx="14"/>
    <text x="${tw / 2}" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="system-ui">${text}</text>
  </svg>`
  return sharp(frameBuffer).composite([{ input: Buffer.from(svg), top: 8, left: 8 }]).png().toBuffer()
}
