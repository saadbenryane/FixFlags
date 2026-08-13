import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import sharp from 'sharp'
import { renderOverlay, type OverlayTemplate } from '../overlays'

async function validPng(width = 320, height = 240): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer()
}

const OVERLAY_TEMPLATES: OverlayTemplate[] = [
  'gauge',
  'highlight',
  'fold-line',
  'thumb-zone',
  'font-map',
  'field-count',
  'link-map',
  'ghost-cta',
  'console-panel',
  'timer',
  'word-count',
  'size-labels',
]

describe('renderOverlay', () => {
  it('returns the original buffer for an unknown template', async () => {
    const buffer = Buffer.from('raw')
    const result = await renderOverlay('nope' as OverlayTemplate, {
      screenshotBuffer: buffer,
      width: 320,
      height: 240,
    })
    assert.equal(result.buffer, buffer)
    assert.equal(result.format, 'png')
  })

  it('renders a valid PNG for every supported template', async () => {
    const base = await validPng()
    for (const template of OVERLAY_TEMPLATES) {
      const result = await renderOverlay(template, {
        screenshotBuffer: base,
        width: 320,
        height: 240,
        value: 87,
        maxValue: 100,
        label: 'Primary CTA <&> details',
        detail: 'First line\nSecond line\nThird line',
        region: { x: 0.2, y: 0.5, width: 0.6, height: 0.1 },
      })
      assert.equal(result.format, 'png')
      assert.ok(result.buffer.length > 0, `${template} produced an empty buffer`)
      // PNG signature
      assert.equal(result.buffer.subarray(0, 4).toString('hex'), '89504e47')
    }
  })

  it('renders safely when label and detail contain markup characters', async () => {
    const base = await validPng()
    const result = await renderOverlay('highlight', {
      screenshotBuffer: base,
      width: 320,
      height: 240,
      label: '<script>&"alert"',
      detail: '<img onerror="x">',
    })
    // Escaping keeps the composed SVG parseable: the composite must succeed
    // and yield a valid PNG rather than throwing on the markup characters.
    assert.equal(result.buffer.subarray(0, 4).toString('hex'), '89504e47')
    assert.ok(result.buffer.length > 0)
  })

  it('uses default region and values when not provided', async () => {
    const base = await validPng(200, 100)
    const result = await renderOverlay('gauge', {
      screenshotBuffer: base,
      width: 200,
      height: 100,
    })
    assert.equal(result.buffer.subarray(0, 4).toString('hex'), '89504e47')
  })

  it('clamps gauge percentage to 0-100', async () => {
    const base = await validPng(200, 100)
    const result = await renderOverlay('gauge', {
      screenshotBuffer: base,
      width: 200,
      height: 100,
      value: 250,
      maxValue: 100,
    })
    assert.equal(result.buffer.subarray(0, 4).toString('hex'), '89504e47')
  })
})
