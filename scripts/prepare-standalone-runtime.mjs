#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const nextDistDir = process.env.NEXT_DIST_DIR || '.next'
const standaloneRoot = join(nextDistDir, 'standalone')
const serverEntry = join(standaloneRoot, 'server.js')

if (!existsSync(serverEntry)) {
  console.error(`Standalone runtime is missing: ${serverEntry}`)
  process.exit(1)
}

const staticSource = join(nextDistDir, 'static')
const staticDestination = join(standaloneRoot, nextDistDir, 'static')
if (!existsSync(staticSource)) {
  console.error(`Next static assets are missing: ${staticSource}`)
  process.exit(1)
}

mkdirSync(staticDestination, { recursive: true })
cpSync(staticSource, staticDestination, { recursive: true })

if (existsSync('public')) {
  cpSync('public', join(standaloneRoot, 'public'), { recursive: true })
}

console.log(`Prepared standalone runtime in ${standaloneRoot}`)
