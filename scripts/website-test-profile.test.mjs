import { execFileSync } from 'node:child_process'
import path from 'node:path'
import assert from 'node:assert/strict'
import { it } from 'node:test'
import { loadConfigFromFile } from 'vite'

const nativeBrowserSuites = [
  'lib/sites/__tests__/checkout-purchase-probe.test.ts',
  'lib/integrity/__tests__/run-path-probe.test.ts',
].sort()

it('website test discovery retains all website suites and parks only machine and repository transports', () => {
  const root = process.cwd()
  const discover = (profile, coverage = false) => JSON.parse(execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly', '--json', ...(coverage ? ['--coverage'] : [])], {
    encoding: 'utf8', env: { ...process.env, FIXFLAGS_TEST_PROFILE: profile },
  })).map(entry => ({ ...entry, file: path.relative(root, entry.file).replaceAll(path.sep, '/') }))
  const files = entries => entries.map(entry => entry.file).sort()
  const parked = file => ['lib/mcp/', 'lib/repo-scan/', 'app/api/mcp/', 'app/api/api-keys/',
    'app/api/integrations/github/repos/', 'app/api/integrations/github/select/',
    'app/api/repo-scans/', 'app/api/webhooks/railway/'].some(prefix => file.startsWith(prefix))
  const allEntries = discover('all'), websiteEntries = discover('website')
  const complete = files(allEntries), website = files(websiteEntries)
  assert.ok(complete.some(parked), 'the preserved power-tool suites remain discoverable')
  assert.deepEqual(website, complete.filter(file => !parked(file)))
  assert.ok(website.some(file => file.includes('site-removal.integration.test.ts')))
  assert.ok(website.some(file => file.includes('claim-anonymous.integration.test.ts')))
  const coverageEntries = discover('website', true)
  assert.deepEqual(files(coverageEntries), website)
  for (const entries of [allEntries, websiteEntries, coverageEntries]) {
    assert.deepEqual(entries.filter(entry => nativeBrowserSuites.includes(entry.file)).map(entry => ({ file: entry.file, projectName: entry.projectName })).sort((a, b) => a.file.localeCompare(b.file)),
      nativeBrowserSuites.map(file => ({ file, projectName: 'native-browser' })))
  }
})

it('real browser suites have one resource owner after the unit and UI phase without relaxed deadlines', async () => {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.resolve('vitest.config.ts'))
  const projects = loaded.config.test.projects.map(project => project.test)
  const native = projects.find(project => project.name === 'native-browser')
  assert.deepEqual([...native.include].sort(), nativeBrowserSuites)
  assert.equal(native.sequence.groupOrder, 1)
  assert.equal(native.maxWorkers, 1)
  assert.equal(native.fileParallelism, false)
  assert.equal(native.testTimeout, 30_000)
  assert.ok(projects.filter(project => project !== native).every(project => (project.sequence?.groupOrder ?? 0) === 0))
})
