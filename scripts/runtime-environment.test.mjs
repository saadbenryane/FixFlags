import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { developmentEnvironment } from '../lib/runtime/environment.mjs'

test('uses Next file precedence, expansion and inherited values', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ff-env-'))
  try {
    writeFileSync(join(cwd, '.env'), 'FF_ROOT=base\nFF_EXPANDED=$FF_ROOT/path\nFF_INHERITED=file\n')
    writeFileSync(join(cwd, '.env.local'), 'FF_ROOT=local\n')
    writeFileSync(join(cwd, '.env.development.local'), 'FF_ROOT=development\n')
    const loaderUrl = new URL('../lib/runtime/environment.mjs', import.meta.url).href
    const code = `import {loadRuntimeEnvironment} from ${JSON.stringify(loaderUrl)};loadRuntimeEnvironment('development',${JSON.stringify(cwd)});console.log(JSON.stringify([process.env.FF_ROOT,process.env.FF_EXPANDED,process.env.FF_INHERITED]))`
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, FF_INHERITED: 'shell' }, encoding: 'utf8' })
    assert.deepEqual(JSON.parse(output), ['development', 'development/path', 'shell'])
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
test('selected development port overrides both application origins once', () => {
  const env = developmentEnvironment(['--port', '3101'], { PORT: '3000', BETTER_AUTH_URL: 'old', NEXT_PUBLIC_APP_URL: 'old', REDIS_URL: 'configured', FIXFLAGS_ALLOW_DUPLICATE_WORKERS: '1' })
  assert.equal(env.BETTER_AUTH_URL, 'http://localhost:3101')
  assert.equal(env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL)
  assert.equal(env.REDIS_URL, 'configured')
  assert.equal(env.FIXFLAGS_ALLOW_DUPLICATE_WORKERS, '0')
  for (const args of [['--port'], ['--port', '80'], ['--other', '3000'], ['--port', 'NaN']]) assert.throws(() => developmentEnvironment(args))
})

test('the TypeScript worker loader preserves launcher overrides through tsx', () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', '-e', "require('./worker/load-env.ts');console.log(process.env.BETTER_AUTH_URL)"], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3102' }, encoding: 'utf8',
  })
  assert.equal(output.trim(), 'http://localhost:3102')
})
