import { execFileSync } from 'node:child_process'
import path from 'node:path'
import assert from 'node:assert/strict'
import { it } from 'node:test'

it('website test discovery retains all website suites and parks only machine and repository transports', () => {
  const root = process.cwd()
  const files = profile => JSON.parse(execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly', '--json'], {
    encoding: 'utf8', env: { ...process.env, FIXFLAGS_TEST_PROFILE: profile },
  })).map(entry => path.relative(root, entry.file).replaceAll(path.sep, '/')).sort()
  const parked = file => ['lib/mcp/', 'lib/repo-scan/', 'app/api/mcp/', 'app/api/api-keys/',
    'app/api/integrations/github/repos/', 'app/api/integrations/github/select/',
    'app/api/repo-scans/', 'app/api/webhooks/railway/'].some(prefix => file.startsWith(prefix))
  const complete = files('all'), website = files('website')
  assert.ok(complete.some(parked), 'the preserved power-tool suites remain discoverable')
  assert.deepEqual(website, complete.filter(file => !parked(file)))
  assert.ok(website.some(file => file.includes('site-removal.integration.test.ts')))
  assert.ok(website.some(file => file.includes('claim-anonymous.integration.test.ts')))
})
