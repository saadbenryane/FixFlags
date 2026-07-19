/**
 * GIF compositor. Composes frame sequences into animated GIFs using omggif.
 */
import sharp from 'sharp'
import { logger } from '@/lib/logger'

// omggif ships CJS; types export GifWriter but ESM interop is inconsistent under tsc.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GifWriter } = require('omggif') as {
  GifWriter: new (
    buf: number[],
    width: number,
    height: number,
    gopts?: { loop?: number }
  ) => {
    addFrame: (
      x: number,
      y: number,
      w: number,
      h: number,
      indexed: number[],
      opts?: { palette?: number[]; delay?: number }
    ) => number
  }
}

export interface GifComposeOptions {
  delayMs?: number
  loops?: number
  width?: number
  height?: number
  /** Max palette size (2–256). Lower = smaller files. */
  maxColors?: number
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

  const { delayMs = 500, loops = 0, width = 640, maxColors = 256 } = options ?? {}
  const targetHeight = options?.height

  const processed: Array<{ indexed: Uint8Array; palette: number[]; width: number; height: number; delay: number }> =
    []

  for (const frame of frames) {
    try {
      let pipeline = sharp(frame.buffer).ensureAlpha()
      const meta = await sharp(frame.buffer).metadata()
      const fw = width
      const fh = targetHeight ?? Math.round(((meta.height ?? 900) / (meta.width ?? width)) * width)
      pipeline = pipeline.resize(fw, fh, { fit: 'fill' })

      const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true })
      const { indexed, palette } = quantizeFrame(data, info.width, info.height, maxColors)
      processed.push({
        indexed,
        palette,
        width: info.width,
        height: info.height,
        delay: Math.max(1, Math.round((frame.delayMs ?? delayMs) / 10)), // omggif uses centiseconds
      })
    } catch (err) {
      logger.error('Failed to process GIF frame', err)
    }
  }

  if (processed.length === 0) return null

  const gifW = processed[0].width
  const gifH = processed[0].height
  const out: number[] = []
  const writer = new GifWriter(out, gifW, gifH, { loop: loops })

  for (const frame of processed) {
    writer.addFrame(0, 0, frame.width, frame.height, Array.from(frame.indexed), {
      palette: frame.palette,
      delay: frame.delay,
    })
  }

  return {
    buffer: Buffer.from(out),
    width: gifW,
    height: gifH,
    frameCount: processed.length,
  }
}

/** Stitch two PNG buffers side-by-side with optional labels. */
export async function composeSideBySide(
  left: Buffer,
  right: Buffer,
  options?: { leftLabel?: string; rightLabel?: string; targetHeight?: number }
): Promise<Buffer> {
  const height = options?.targetHeight ?? 480
  const leftImg = await sharp(left)
    .resize({ height, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true })
  const rightImg = await sharp(right)
    .resize({ height, fit: 'inside' })
    .png()
    .toBuffer({ resolveWithObject: true })

  const gap = 8
  const labelH = options?.leftLabel || options?.rightLabel ? 28 : 0
  const canvasW = leftImg.info.width + rightImg.info.width + gap
  const canvasH = Math.max(leftImg.info.height, rightImg.info.height) + labelH

  const composites: sharp.OverlayOptions[] = [
    { input: leftImg.data, top: labelH, left: 0 },
    { input: rightImg.data, top: labelH, left: leftImg.info.width + gap },
  ]

  if (options?.leftLabel) {
    composites.push({
      input: Buffer.from(labelSvg(options.leftLabel, leftImg.info.width)),
      top: 0,
      left: 0,
    })
  }
  if (options?.rightLabel) {
    composites.push({
      input: Buffer.from(labelSvg(options.rightLabel, rightImg.info.width)),
      top: 0,
      left: leftImg.info.width + gap,
    })
  }

  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 24, g: 24, b: 27 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer()
}

function labelSvg(text: string, width: number): string {
  const safe = text.replace(/[<>&]/g, '')
  return `<svg width="${width}" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="28" fill="#18181b"/>
    <text x="8" y="18" fill="#fafafa" font-size="12" font-family="system-ui,sans-serif">${safe}</text>
  </svg>`
}

function quantizeFrame(
  rgba: Buffer,
  width: number,
  height: number,
  maxColors: number
): { indexed: Uint8Array; palette: number[] } {
  const pixelCount = width * height
  const colorMap = new Map<number, number>()

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3)
    colorMap.set(key, (colorMap.get(key) ?? 0) + 1)
  }

  const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.min(256, maxColors))
  const palette: number[] = sorted.map(([k]) => {
    const r = ((k >> 10) & 0x1f) << 3
    const g = ((k >> 5) & 0x1f) << 3
    const b = (k & 0x1f) << 3
    return (r << 16) | (g << 8) | b
  })
  while (palette.length < 2) palette.push(0)
  // GifWriter requires power-of-2 palette sizes
  while (palette.length < 256 && (palette.length & (palette.length - 1)) !== 0) {
    palette.push(0)
  }

  const lookup = new Map<number, number>()
  sorted.forEach(([k], i) => lookup.set(k, i))

  const indexed = new Uint8Array(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    if (rgba[off + 3] < 128) {
      indexed[i] = 0
      continue
    }
    const key = ((rgba[off] >> 3) << 10) | ((rgba[off + 1] >> 3) << 5) | (rgba[off + 2] >> 3)
    indexed[i] = lookup.get(key) ?? 0
  }

  return { indexed, palette }
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
  frameBuffer: Buffer,
  text: string,
  color: 'red' | 'amber' | 'green' = 'red'
): Promise<Buffer> {
  const colors = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' }
  const tw = text.length * 9 + 24
  const svg = `<svg width="${tw}" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${tw}" height="28" fill="${colors[color]}" rx="14"/>
    <text x="${tw / 2}" y="19" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="system-ui">${text}</text>
  </svg>`
  return sharp(frameBuffer).composite([{ input: Buffer.from(svg), top: 8, left: 8 }]).png().toBuffer()
}
