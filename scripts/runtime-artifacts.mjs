import { existsSync } from 'node:fs'
import { join } from 'node:path'

export function runtimeEntry(mode, root = process.cwd(), env = process.env) {
  if (!['web', 'worker'].includes(mode)) throw new Error('Usage: node scripts/runtime-start.mjs <web|worker>')
  const dist = env.NEXT_DIST_DIR || '.next'
  const packaged = existsSync(join(root, 'server.js'))
  const entry = mode === 'worker' ? 'dist/worker/index.js' : packaged ? 'server.js' : `${dist}/standalone/server.js`
  const build = mode === 'worker' ? 'npm run worker:build' : 'npm run build'
  if (!existsSync(join(root, entry))) throw new Error(`Runtime entry is missing: ${entry}. Run ${build} before starting. For development, use npm run dev.`)
  if (mode === 'worker' && !existsSync(join(root, 'dist/worker/check-parser.js'))) {
    throw new Error('Worker parser runtime is missing: dist/worker/check-parser.js. Run npm run worker:build before starting.')
  }
  if (mode === 'web') {
    const base = packaged ? root : join(root, dist, 'standalone')
    for (const asset of [join(dist, 'static'), 'public']) {
      if (!existsSync(join(base, asset))) throw new Error(`Runtime assets are missing: ${asset}. Run npm run build before starting.`)
    }
  }
  return entry
}
