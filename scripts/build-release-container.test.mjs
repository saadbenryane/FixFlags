import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import ts from 'typescript'
import { releaseContainerBuildArguments } from './build-release-container.mjs'

const sha = 'a'.repeat(40)
const settings = {
  NEXT_PUBLIC_APP_URL: 'https://validation.example.com',
  BETTER_AUTH_URL: 'https://validation.example.com',
  NEXT_PUBLIC_GA_ID: 'G-EXAMPLE123',
  RESEND_API_KEY: 'private-provider-key',
  BETTER_AUTH_SECRET: 'private-auth-secret',
}
describe('release image configuration', () => {
  it('checks generated route guards in standard and isolated builds while excluding copied output', () => {
    const root = mkdtempSync(join(tmpdir(), 'fixflags-route-types-'))
    try {
      const guards = ['.next/types/validator.ts', '.next/types/app/api/example/route.ts',
        '.next-e2e/types/validator.ts', '.next-e2e/types/app/api/example/route.ts',
        '.next-verify/types/validator.ts', '.next-verify/types/app/api/example/route.ts']
      const output = ['.next/standalone/copied.ts', '.next-e2e/standalone/copied.ts',
        '.next-verify/server/generated.ts', '.next-e2e/cache/generated.ts']
      for (const file of [...guards, ...output]) {
        const path = join(root, file)
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, 'export {}\n')
      }
      const config = JSON.parse(readFileSync(new URL('../tsconfig.json', import.meta.url), 'utf8'))
      const parsed = ts.parseJsonConfigFileContent(config, ts.sys, root)
      assert.deepEqual(parsed.errors, [])
      const selected = parsed.fileNames.map(file => relative(root, file))
      for (const file of guards) assert.ok(selected.includes(file), `Missing route guard: ${file}`)
      for (const file of output) assert.ok(!selected.includes(file), `Copied output entered type checking: ${file}`)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
  it('builds the designated public origin and exact revision without secrets', () => {
    const args = releaseContainerBuildArguments(settings, sha)
    assert.ok(args.includes(`GIT_COMMIT_SHA=${sha}`))
    assert.ok(args.includes(`NEXT_PUBLIC_APP_URL=${settings.NEXT_PUBLIC_APP_URL}`))
    assert.ok(args.includes(`NEXT_PUBLIC_GA_ID=${settings.NEXT_PUBLIC_GA_ID}`))
    assert.ok(args.includes('NEXT_PUBLIC_GA_PAGEVIEW_MODE=automatic'))
    assert.ok(!args.join(' ').includes('private-'))
  })
  it('rejects a verification runtime paired with a production build', () => {
    assert.throws(() => releaseContainerBuildArguments({ ...settings, BETTER_AUTH_URL: 'https://fixflags.com' }, sha))
  })
  it('rejects app URLs containing credentials or paths', () => {
    for (const url of ['https://user:password@example.com', 'https://example.com/path', 'https://example.com/?secret=value', 'https://example.com/#settings', 'file:///app'])
      assert.throws(() => releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_APP_URL: url, BETTER_AUTH_URL: url }, sha))
    assert.throws(() => releaseContainerBuildArguments({ ...settings, BETTER_AUTH_URL: 'https://user:password@validation.example.com' }, sha))
  })
  it('rejects missing or abbreviated source revisions', () => {
    for (const value of [undefined, '', sha.slice(0, 7)])
      assert.throws(() => releaseContainerBuildArguments(settings, value))
  })
  it('permits an environment without analytics and rejects invalid IDs', () => {
    assert.ok(releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_ID: '' }, sha).includes('NEXT_PUBLIC_GA_ID='))
    assert.throws(() => releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_ID: 'private-secret' }, sha))
  })
  it('forwards the controlled pageview mode and rejects unsupported values', () => {
    assert.ok(releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_PAGEVIEW_MODE: 'controlled' }, sha)
      .includes('NEXT_PUBLIC_GA_PAGEVIEW_MODE=controlled'))
    assert.throws(() => releaseContainerBuildArguments({ ...settings, NEXT_PUBLIC_GA_PAGEVIEW_MODE: 'unknown' }, sha))
  })
})
