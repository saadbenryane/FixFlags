import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repository = new URL('..', import.meta.url)
const cliDirectory = new URL('../fixflags-cli/', import.meta.url)
const temporary = mkdtempSync(join(tmpdir(), 'fixflags-cli-package-'))

try {
  const packOutput = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', temporary],
    {
    cwd: cliDirectory,
    encoding: 'utf8',
    }
  )
  const packed = JSON.parse(packOutput)[0]
  const tarball = join(temporary, packed.filename)
  execFileSync('npm', ['init', '-y'], { cwd: temporary, stdio: 'ignore' })
  execFileSync('npm', ['install', tarball], { cwd: temporary, stdio: 'inherit' })
  const output = execFileSync(
    process.execPath,
    [join(temporary, 'node_modules', 'fixflags', 'bin', 'fixflags.js'), '--version'],
    { cwd: repository, encoding: 'utf8' }
  )
  assert.match(output, /^\d+\.\d+\.\d+/)
  console.log(`PASS clean CLI install (${output.trim()})`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
