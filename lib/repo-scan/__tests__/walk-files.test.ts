import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { walkScannableFiles } from '../walk-files'
import { MAX_FILE_SIZE_BYTES } from '../constants'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'walk-files-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('walkScannableFiles', () => {
  it('returns text files with repo-relative forward-slash paths', async () => {
    await writeFile(join(root, 'index.js'), 'console.log(1)')
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'app.ts'), 'export const x = 1')

    const files = await walkScannableFiles(root)
    const paths = files.map((f) => f.path).sort()
    expect(paths).toEqual(['index.js', 'src/app.ts'])
    expect(files.find((f) => f.path === 'index.js')?.content).toBe('console.log(1)')
  })

  it('skips ignored directories like node_modules and .git', async () => {
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await writeFile(join(root, 'node_modules', 'dep.js'), 'module.exports = {}')
    await mkdir(join(root, '.git'), { recursive: true })
    await writeFile(join(root, '.git', 'config'), '[core]')
    await writeFile(join(root, 'keep.js'), 'ok')

    const paths = (await walkScannableFiles(root)).map((f) => f.path)
    expect(paths).toEqual(['keep.js'])
  })

  it('skips empty files and files over the size cap', async () => {
    await writeFile(join(root, 'empty.js'), '')
    await writeFile(join(root, 'huge.js'), 'x'.repeat(MAX_FILE_SIZE_BYTES + 1))
    await writeFile(join(root, 'fine.js'), 'real content')

    const paths = (await walkScannableFiles(root)).map((f) => f.path)
    expect(paths).toEqual(['fine.js'])
  })

  it('skips likely-binary paths', async () => {
    await writeFile(join(root, 'logo.png'), 'not really a png but named one')
    await writeFile(join(root, 'main.ts'), 'export default 1')

    const paths = (await walkScannableFiles(root)).map((f) => f.path)
    expect(paths).toEqual(['main.ts'])
  })
})
