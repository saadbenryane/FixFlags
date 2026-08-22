/** Regenerate repository-owned sample observations without production reads or writes. */
import { execFileSync } from 'node:child_process'

const baseUrl = process.env.SAMPLE_CAPTURE_BASE_URL ?? 'http://127.0.0.1:3000'

new URL(baseUrl)
process.stdout.write(`Refreshing curated sample observations from ${baseUrl}\n`)
execFileSync('npx', ['tsx', 'scripts/capture-sample-screenshots.ts'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, SAMPLE_CAPTURE_BASE_URL: baseUrl },
})
process.stdout.write('Curated sample bundle refreshed. Verify /samples and both history destinations.\n')
