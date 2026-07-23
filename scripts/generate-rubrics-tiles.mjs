/**
 * Generate mobile rubric scene tiles from the panorama sources.
 *
 *   node scripts/generate-rubrics-tiles.mjs
 */
import sharp from 'sharp'
import path from 'node:path'

const ROOT = path.join(process.cwd(), 'public/marketing/visuals')

const SCENES = [
  { name: 'rubrics-01', index: 0 },
  { name: 'rubrics-02', index: 1 },
  { name: 'rubrics-03', index: 2 },
]

async function extractTile(source, target, sceneIndex) {
  const file = path.join(ROOT, source)
  const metadata = await sharp(file).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const tileWidth = Math.floor(width / 3)
  const left = sceneIndex * tileWidth

  await sharp(file)
    .extract({ left, top: 0, width: tileWidth, height })
    .resize(512, 512, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(path.join(ROOT, target))
}

for (const scene of SCENES) {
  await extractTile('rubrics-light.webp', `${scene.name}-light.webp`, scene.index)
  await extractTile('rubrics-dark.webp', `${scene.name}-dark.webp`, scene.index)
  console.log(`wrote ${scene.name}-{light,dark}.webp`)
}
