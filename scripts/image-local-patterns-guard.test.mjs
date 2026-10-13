import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const guard = new URL('./image-local-patterns-guard.mjs', import.meta.url)

test('requires optimization access for versioned illustrative captures', () => {
  const root = mkdtempSync(join(tmpdir(), 'fixflags-image-patterns-'))
  try {
    mkdirSync(join(root, 'app')); mkdirSync(join(root, 'components'))
    const patterns = ['/api/screenshots/**', '/brand/**', '/marketing/**']
    const run = list => {
      writeFileSync(join(root, 'next.config.ts'), `export default { images: {localPatterns: [${list.map(pathname => `{pathname: ${JSON.stringify(pathname)}}`).join(',')}]}}`)
      return spawnSync(process.execPath, [guard.pathname], { cwd: root, encoding: 'utf8' })
    }
    const refused = run(patterns)
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /missing required pathname '\/samples\/observations\/\*\*'/)
    assert.equal(run([...patterns, '/samples/observations/**']).status, 0)
  } finally { rmSync(root, {recursive:true, force:true}) }
})
