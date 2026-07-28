import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { LANDING_PAGE } from '@/lib/marketing/copy'

const ROOT = process.cwd()

const PERMANENT_HOMEPAGE_ASSETS = [
  '/marketing/visuals/home-hero-master-v2.webp',
  '/marketing/visuals/how-it-works-glass-plate-v2.webp',
  '/marketing/visuals/builder-workflow-scene-v2.webp',
  ...LANDING_PAGE.editorIntegrations.steps.map((step) => step.visual.src),
] as const

describe('homepage permanent artwork', () => {
  it.each(PERMANENT_HOMEPAGE_ASSETS)('%s exists, is high-density, and has alpha', async (src) => {
    const file = path.join(ROOT, 'public', src)
    await expect(access(file)).resolves.toBeUndefined()

    const [fileStat, metadata] = await Promise.all([
      stat(file),
      sharp(file).metadata(),
    ])

    expect(fileStat.size).toBeGreaterThan(10_000)
    expect(metadata.width).toBeGreaterThanOrEqual(1200)
    expect(metadata.height).toBeGreaterThanOrEqual(900)
    expect(metadata.hasAlpha).toBe(true)
  })

  it('does not ship the superseded Lighthouse-oriented artwork', async () => {
    const removed = [
      'home-hero-reference.webp',
      'how-it-works-step-01.webp',
      'how-it-works-step-02.webp',
      'how-it-works-step-03.webp',
    ]

    for (const filename of removed) {
      await expect(
        access(path.join(ROOT, 'public', 'marketing', 'visuals', filename))
      ).rejects.toBeDefined()
    }
  })
})
