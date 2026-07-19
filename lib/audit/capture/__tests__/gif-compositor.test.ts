import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { composeGif, composeSideBySide } from '@/lib/audit/capture/gif-compositor'
import { getVisualDescriptor } from '@/lib/audit/capture/visual-types'

async function solidPng(color: { r: number; g: number; b: number }, size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer()
}

describe('gif-compositor', () => {
  it('composes a multi-frame GIF', async () => {
    const a = await solidPng({ r: 200, g: 40, b: 40 })
    const b = await solidPng({ r: 40, g: 40, b: 200 })
    const gif = await composeGif(
      [
        { buffer: a, delayMs: 200 },
        { buffer: b, delayMs: 200 },
      ],
      { width: 64, height: 64 }
    )
    expect(gif).not.toBeNull()
    expect(gif!.frameCount).toBe(2)
    expect(gif!.buffer.length).toBeGreaterThan(20)
    expect(gif!.buffer[0]).toBe(0x47) // G
    expect(gif!.buffer[1]).toBe(0x49) // I
    expect(gif!.buffer[2]).toBe(0x46) // F
  })

  it('composes side-by-side panels', async () => {
    const left = await solidPng({ r: 20, g: 20, b: 20 })
    const right = await solidPng({ r: 220, g: 220, b: 220 })
    const out = await composeSideBySide(left, right, {
      leftLabel: 'Source',
      rightLabel: 'Destination',
      targetHeight: 64,
    })
    const meta = await sharp(out).metadata()
    expect(meta.width).toBeGreaterThan(64)
    expect(meta.format).toBe('png')
  })
})

describe('visual-types', () => {
  it('returns none for unknown checks', () => {
    expect(getVisualDescriptor('not-a-real-check').type).toBe('none')
  })

  it('maps flow-cta-404 to side-by-side', () => {
    expect(getVisualDescriptor('flow-cta-404').type).toBe('side-by-side')
  })
})
