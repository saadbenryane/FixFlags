import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { invalidateVerificationCandidate, prepareVerificationRuntime, recordVerificationCandidate, requireVerificationCandidate, sourceIdentity } from './verification-candidate.mjs'

const standalone = '.next-e2e/standalone'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'fixflags-verification-candidate-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  function write(file, value) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), value)
  }
  git('init', '-q')
  write('.gitignore', '/.next-e2e/\n')
  write('app.ts', 'original source')
  git('add', '.')
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Fixture source')
  write(`${standalone}/server.js`, 'compiled server')
  write(`${standalone}/.next-e2e/BUILD_ID`, 'fixture-build')
  write(`${standalone}/.next-e2e/static/client.js`, 'compiled client')
  return { root, write }
}

test('accepts a dirty source snapshot and its exact packaged web output', t => {
  const { root, write } = fixture(t)
  write('app.ts', 'changed source')
  write('worker.ts', 'new worker source')
  const source = sourceIdentity(root)
  recordVerificationCandidate(root, source)
  const candidate = requireVerificationCandidate(root)
  assert.deepEqual(candidate.source, source)
  assert.equal(candidate.source.clean, false)
  assert.equal(candidate.appBuildId, 'fixture-build')
  assert.match(candidate.appBundleSha256, /^[0-9a-f]{64}$/)
  const runtime = '.next-e2e/runtime-copy'
  prepareVerificationRuntime(root, join(root, runtime), candidate)
  write(`${runtime}/.next-e2e/server/route-cache/generated.html`, 'runtime cache')
  assert.deepEqual(requireVerificationCandidate(root), candidate)
  invalidateVerificationCandidate(root)
  assert.throws(() => requireVerificationCandidate(root), /record is missing or unreadable/)
})

test('refuses source drift during build and rejects edits before a journey', t => {
  const { root, write } = fixture(t)
  const source = sourceIdentity(root)
  write('app.ts', 'different source')
  assert.throws(() => recordVerificationCandidate(root, source), /source changed/)
  assert.throws(() => requireVerificationCandidate(root), /record is missing or unreadable/)
  recordVerificationCandidate(root, sourceIdentity(root))
  rmSync(join(root, 'app.ts'))
  assert.throws(() => requireVerificationCandidate(root), /source changed/)
})

test('refuses modified standalone bytes even with the same build ID and checkout', t => {
  const { root, write } = fixture(t)
  recordVerificationCandidate(root, sourceIdentity(root))
  write(`${standalone}/.next-e2e/static/client.js`, 'different compiled client')
  assert.equal(readFileSync(join(root, standalone, '.next-e2e/BUILD_ID'), 'utf8'), 'fixture-build')
  assert.throws(() => requireVerificationCandidate(root), /web bundle changed/)
})
