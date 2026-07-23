#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: path.join(root, '.env.local'), override: false })
config({ override: false })

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('node', ['scripts/evals/runtime-recovery.mjs'])
run(
  'npx',
  ['vitest', 'run', 'lib/audit/__tests__/recover-audit-app-queue.integration.test.ts'],
  { RECOVERY_APP_QUEUE_REQUIRED: 'true' },
)

console.log('Recovery evaluation passed: isolated BullMQ queue and application audit queue requeue path.')
