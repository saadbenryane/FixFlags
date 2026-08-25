#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageName = 'fixflags'

function flag(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

export function validateRegistryMetadata(metadata, version, requiredTag, expectedGitSha) {
  const manifest = metadata.versions?.[version]
  if (!manifest || manifest.version !== version || !manifest.dist?.tarball) {
    throw new Error(`npm returned no valid manifest for ${packageName}@${version}`)
  }
  if (requiredTag && metadata['dist-tags']?.[requiredTag] !== version) {
    throw new Error(`npm ${requiredTag} does not point to ${packageName}@${version}`)
  }
  if (expectedGitSha && manifest.gitHead !== expectedGitSha) {
    throw new Error(`npm ${packageName}@${version} does not attest the candidate Git SHA`)
  }
  return {
    version,
    tag: requiredTag ?? null,
    tarball: manifest.dist.tarball,
    integrity: manifest.dist.integrity ?? null,
    shasum: manifest.dist.shasum ?? null,
    gitSha: manifest.gitHead ?? null,
  }
}

function cleanInstall(version) {
  const directory = mkdtempSync(path.join(tmpdir(), 'fixflags-registry-'))
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  try {
    execFileSync(npm, ['init', '-y'], { cwd: directory, stdio: 'ignore' })
    execFileSync(npm, ['install', '--ignore-scripts', `${packageName}@${version}`], {
      cwd: directory,
      stdio: 'inherit',
    })
    const cli = path.join(directory, 'node_modules', packageName, 'bin', 'fixflags.js')
    const installedVersion = execFileSync(process.execPath, [cli, '--version'], {
      cwd: directory,
      encoding: 'utf8',
    }).trim()
    assert.equal(installedVersion, version)
    return installedVersion
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

export async function verifyCliRegistry({ version, requiredTag, expectedGitSha, clean = false, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://registry.npmjs.org/${packageName}`)
  if (!response.ok) throw new Error(`npm registry request failed (${response.status})`)
  const metadata = await response.json()
  const evidence = validateRegistryMetadata(metadata, version, requiredTag, expectedGitSha)
  return {
    schemaVersion: 1,
    packageName,
    ...evidence,
    installedVersion: clean ? cleanInstall(version) : null,
    verifiedAt: new Date().toISOString(),
  }
}

async function main() {
  const packageVersion = (await import('../fixflags-cli/package.json', { with: { type: 'json' } })).default.version
  const version = flag('--version') ?? packageVersion
  const requiredTag = flag('--tag')
  const clean = process.argv.includes('--clean-install')
  const evidence = await verifyCliRegistry({
    version,
    requiredTag,
    expectedGitSha: process.env.RELEASE_EXPECTED_GIT_SHA,
    clean,
  })
  const target = process.env.RELEASE_CLI_REGISTRY_EVIDENCE_FILE
  if (target) {
    mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
    writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
    chmodSync(target, 0o600)
  }
  console.log(`PASS ${packageName}@${version} is available from npm${requiredTag ? ` on ${requiredTag}` : ''}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
