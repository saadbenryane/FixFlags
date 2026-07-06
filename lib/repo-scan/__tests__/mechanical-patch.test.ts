import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildMechanicalPatch } from '@/lib/repo-scan/mechanical-patch'

const execFileAsync = promisify(execFile)

let repoDir: string

async function git(...args: string[]) {
  await execFileAsync('git', args, { cwd: repoDir })
}

beforeEach(async () => {
  repoDir = await mkdtemp(join(tmpdir(), 'mechanical-patch-'))
  await git('init', '-q')
  await git('config', 'user.email', 'test@example.com')
  await git('config', 'user.name', 'Test')
})

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true })
})

describe('buildMechanicalPatch', () => {
  it('is a no-op for a finding that is not auto-patchable', async () => {
    const result = await buildMechanicalPatch(
      { category: 'Dependency hygiene', filePath: 'package.json' },
      repoDir
    )
    assert.equal(result.changed, false)
  })

  it('untracks a committed .env file and adds it to .gitignore', async () => {
    await writeFile(join(repoDir, '.env'), 'API_KEY=super-secret\n')
    await git('add', '.env')
    await git('commit', '-q', '-m', 'add env')

    const result = await buildMechanicalPatch(
      { category: 'Exposed secret', filePath: '.env' },
      repoDir
    )

    assert.equal(result.changed, true)
    assert.match(result.description, /rotate/i)

    const gitignore = await readFile(join(repoDir, '.gitignore'), 'utf8')
    assert.match(gitignore, /^\.env$/m)

    const { stdout } = await execFileAsync('git', ['ls-files', '.env'], { cwd: repoDir })
    assert.equal(stdout.trim(), '', '.env should no longer be tracked')

    // The file itself is untouched on disk - only untracked from git.
    const envContent = await readFile(join(repoDir, '.env'), 'utf8')
    assert.equal(envContent, 'API_KEY=super-secret\n')
  })

  it('is idempotent when the file is already ignored and untracked', async () => {
    await writeFile(join(repoDir, '.env'), 'API_KEY=super-secret\n')
    await writeFile(join(repoDir, '.gitignore'), '.env\n')
    await git('add', '.gitignore')
    await git('commit', '-q', '-m', 'add gitignore')

    const result = await buildMechanicalPatch(
      { category: 'Exposed secret', filePath: '.env' },
      repoDir
    )

    assert.equal(result.changed, false)
    const gitignore = await readFile(join(repoDir, '.gitignore'), 'utf8')
    // Still exactly one entry - no duplicate appended.
    assert.equal(gitignore.trim(), '.env')
  })

  it('appends to an existing .gitignore without clobbering other entries', async () => {
    await writeFile(join(repoDir, '.gitignore'), 'node_modules\n')
    await writeFile(join(repoDir, '.env.local'), 'TOKEN=abc\n')
    await git('add', '.gitignore', '.env.local')
    await git('commit', '-q', '-m', 'seed')

    await buildMechanicalPatch({ category: 'Exposed secret', filePath: '.env.local' }, repoDir)

    const gitignore = await readFile(join(repoDir, '.gitignore'), 'utf8')
    assert.match(gitignore, /node_modules/)
    assert.match(gitignore, /\.env\.local/)
  })
})
