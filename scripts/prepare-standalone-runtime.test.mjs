import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const script = fileURLToPath(new URL('./prepare-standalone-runtime.mjs', import.meta.url))

test('copies static and public assets beside the standalone server', () => {
  const root = mkdtempSync(join(tmpdir(), 'fixflags-standalone-'))

  try {
    write(join(root, '.next/standalone/server.js'), 'server')
    write(join(root, '.next/static/css/app.css'), 'body{}')
    write(join(root, 'public/brand/mark.png'), 'image')

    execFileSync(process.execPath, [script], { cwd: root, stdio: 'pipe' })

    assert.equal(readFileSync(join(root, '.next/standalone/.next/static/css/app.css'), 'utf8'), 'body{}')
    assert.equal(readFileSync(join(root, '.next/standalone/public/brand/mark.png'), 'utf8'), 'image')
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

function write(file, contents) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}
