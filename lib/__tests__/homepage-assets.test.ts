import { access, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

interface ArtworkManifestEntry {
  id: string
  src: string
  width: number
  height: number
  requiresAlpha: boolean
  contentBearing: boolean
  requiredTerms: string[]
}

const manifest = JSON.parse(
  await readFile(
    path.join(ROOT, 'lib', 'marketing', 'artwork-manifest.json'),
    'utf8'
  )
) as { assets: ArtworkManifestEntry[] }

describe('homepage permanent artwork', () => {
  it.each(manifest.assets)(
    '$id exists and matches its recorded delivery contract',
    async ({ src, width, height, requiresAlpha }) => {
      const file = path.join(ROOT, 'public', src)
      await expect(access(file)).resolves.toBeUndefined()

      const [fileStat, metadata] = await Promise.all([
        stat(file),
        sharp(file).metadata(),
      ])

      expect(fileStat.size).toBeGreaterThan(10_000)
      expect(metadata.width).toBe(width)
      expect(metadata.height).toBe(height)
      if (requiresAlpha) {
        expect(metadata.hasAlpha).toBe(true)
      }
    }
  )

  it('records product-truth terms for every content-bearing illustration', () => {
    for (const asset of manifest.assets.filter((entry) => entry.contentBearing)) {
      expect(asset.requiredTerms.length, asset.id).toBeGreaterThan(0)
      expect(asset.requiredTerms.join(' ')).not.toMatch(
        /Run Audit|Lighthouse|Performance Score|Best Practices|automatic PR|coming soon/i
      )
    }
  })

  it('keeps every generated asset inside the permanent public directory', async () => {
    for (const { src } of manifest.assets) {
      const file = path.join(ROOT, 'public', src)
      await expect(access(file)).resolves.toBeUndefined()
    }
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
