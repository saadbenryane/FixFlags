#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const databaseUrl = process.env.RELEASE_FRESH_DATABASE_URL
if (!databaseUrl) throw new Error('RELEASE_FRESH_DATABASE_URL is required for the fresh-migration release gate')
if (process.env.RELEASE_ALLOW_DATABASE_RESET !== 'true') {
  throw new Error('RELEASE_ALLOW_DATABASE_RESET=true is required to reset the designated release database')
}
if (databaseUrl === process.env.DATABASE_URL) throw new Error('Release database must not equal DATABASE_URL')

const parsed = new URL(databaseUrl)
const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase()
if (!/(?:release|test)/.test(databaseName)) {
  throw new Error(`Refusing to reset database without release/test in its name: ${databaseName}`)
}

const result = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed'], {
  cwd: process.cwd(),
  env: { ...process.env, DATABASE_URL: databaseUrl },
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})
if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'Fresh migration failed').trim())
console.log('Fresh release database migration passed.')
