#!/usr/bin/env node

import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const cacheDirectory = path.join(process.cwd(), '.cache')
const lockFile = path.join(cacheDirectory, 'next-build.lock')
const waitBuffer = new Int32Array(new SharedArrayBuffer(4))
mkdirSync(cacheDirectory, { recursive: true })

let lockFd
while (lockFd == null) {
  try {
    lockFd = openSync(lockFile, 'wx')
    writeFileSync(lockFd, String(process.pid))
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error
    const owner = Number(readFileSync(lockFile, 'utf8'))
    let ownerAlive = Number.isInteger(owner) && owner > 0
    if (ownerAlive) {
      try { process.kill(owner, 0) } catch { ownerAlive = false }
    }
    if (!ownerAlive) {
      try { unlinkSync(lockFile) } catch { /* another waiter recovered it */ }
      continue
    }
    console.log(`Waiting for verification build ${owner} to finish...`)
    Atomics.wait(waitBuffer, 0, 0, 1_000)
  }
}

try {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, NEXT_DIST_DIR: '.next-verify' },
    stdio: 'inherit',
  })
  process.exitCode = result.status ?? 1
} finally {
  closeSync(lockFd)
  try { unlinkSync(lockFile) } catch { /* process shutdown will leave a recoverable stale lock */ }
}
