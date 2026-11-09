import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { constants, cpSync, lstatSync, readFileSync, readdirSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertNoPackagedRuntimeData } from './runtime-artifacts.mjs'

const dist = '.next-e2e'
const schema = 'fixflags.local-verification-candidate.v1'
const manifestPath = root => join(root, dist, 'verification-candidate.json')
const bundlePath = root => join(root, dist, 'standalone')
const sha256 = value => createHash('sha256').update(value).digest('hex')

function fileIdentity(path, stat) {
  if (!stat) return null
  if (stat.isSymbolicLink()) return ['symlink', sha256(readlinkSync(path))]
  if (!stat.isFile()) throw new Error('Candidate input is not a file: ' + path)
  return ['file', stat.mode & 0o111, sha256(readFileSync(path))]
}

export function sourceIdentity(root = process.cwd()) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const paths = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort()
  const digest = createHash('sha256')
  for (const file of paths) {
    const path = join(root, file)
    digest.update(JSON.stringify([file, fileIdentity(path, lstatSync(path, { throwIfNoEntry: false }))]))
  }
  return { gitSha: git(['rev-parse', 'HEAD']).trim(), clean: git(['status', '--porcelain']).trim() === '',
    sourceHashVersion: 2, sourceSha256: digest.digest('hex'), files: paths.length }
}

export function assertCandidateSource(root, expected) {
  const current = sourceIdentity(root)
  if (expected?.sourceHashVersion !== current.sourceHashVersion || expected.gitSha !== current.gitSha ||
      expected.sourceSha256 !== current.sourceSha256) {
    throw new Error('Verification candidate source changed. Rebuild with node scripts/next-build.mjs .next-e2e.')
  }
}

function webBundle(standalone) {
  assertNoPackagedRuntimeData(standalone)
  const digest = createHash('sha256')
  function visit(relative) {
    for (const name of readdirSync(join(standalone, relative)).sort()) {
      const child = join(relative, name)
      const path = join(standalone, child)
      const stat = lstatSync(path)
      if (stat.isDirectory()) visit(child)
      else digest.update(JSON.stringify([child, fileIdentity(path, stat)]))
    }
  }
  const appBuildId = readFileSync(join(standalone, dist, 'BUILD_ID'), 'utf8').trim()
  if (!appBuildId || !lstatSync(join(standalone, 'server.js')).isFile()) throw new Error('Standalone verification entry is missing')
  visit('')
  return { appBuildId, appBundleSha256: digest.digest('hex') }
}

export function invalidateVerificationCandidate(root) {
  rmSync(manifestPath(root), { force: true })
}

export function recordVerificationCandidate(root, source) {
  const web = webBundle(bundlePath(root))
  assertCandidateSource(root, source)
  writeFileSync(manifestPath(root), JSON.stringify({ schema, source, ...web }, null, 2) + '\n', { flag: 'wx' })
}

function assertWebBundle(path, record) {
  const web = webBundle(path)
  if (record.appBuildId !== web.appBuildId || record.appBundleSha256 !== web.appBundleSha256) {
    throw new Error('Verification web bundle changed. Rebuild with node scripts/next-build.mjs .next-e2e.')
  }
}

export function prepareVerificationRuntime(root, destination, record) {
  // Next writes its route cache at runtime. Give it a private copy and keep the
  // original package available for verification at the end of the journey.
  cpSync(bundlePath(root), destination, { recursive: true, force: false, errorOnExist: true,
    mode: constants.COPYFILE_FICLONE, verbatimSymlinks: true })
  assertWebBundle(destination, record)
}

export function requireVerificationCandidate(root) {
  let record
  try { record = JSON.parse(readFileSync(manifestPath(root), 'utf8')) }
  catch { throw new Error('Verification candidate record is missing or unreadable. Run node scripts/next-build.mjs .next-e2e.') }
  if (record?.schema !== schema) throw new Error('Unsupported verification candidate record. Rebuild with node scripts/next-build.mjs .next-e2e.')
  assertCandidateSource(root, record.source)
  assertWebBundle(bundlePath(root), record)
  return record
}
