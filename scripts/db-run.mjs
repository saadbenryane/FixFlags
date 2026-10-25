#!/usr/bin/env node
/**
 * Production-safe wrapper for Prisma CLI commands.
 *
 * Locally: loads .env.local via `dotenv` (a prod dependency) so `prisma migrate
 * deploy` can read DATABASE_URL the same way `dotenv-cli` used to.
 *
 * In Docker / Railway: .env.local doesn't exist (and isn't needed, env vars
 * are injected by the platform), so Prisma reads them from the process directly.
 */
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

if (existsSync('.env.local')) config({ path: '.env.local', override: false })

const args = process.argv.slice(2)
if (args[0] === 'prisma') args.shift()
if (args.length === 0) {
  console.error('Usage: node scripts/db-run.mjs <prisma command args>')
  process.exit(1)
}

const prismaCli = fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url))
if (args[0] === 'migrate' && args[1] === 'deploy') {
  const { deployMigrations } = await import('../lib/runtime/migration-coordination.mjs')
  try { process.exit(await deployMigrations({ args })) }
  catch (error) { console.error(error.message); process.exit(1) }
}
const result = spawnSync(process.execPath, [prismaCli, ...args], {
  stdio: 'inherit',
  env: process.env,
})
process.exit(result.status ?? 1)
