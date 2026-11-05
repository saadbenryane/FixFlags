import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, cp, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { ROOT, buildPlugin, validatePackage, packagePath, toolContract, deterministicZip } from './build-chatgpt-plugin.mjs'

async function inputs() {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'integrations/chatgpt-plugin/plugin.json')))
  const mcp = JSON.parse(await readFile(resolve(ROOT, 'integrations/chatgpt-plugin/mcp.json')))
  const registry = JSON.parse(await readFile(resolve(ROOT, 'lib/mcp/tool-registry.json')))
  const files = new Map()
  for (const name of ['plugin.json', 'mcp.json', 'README.md', 'assets/composer.png', 'assets/logo.png']) files.set(name, await readFile(resolve(ROOT, 'integrations/chatgpt-plugin', name)))
  return { manifest, mcp, registry, files }
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'fixflags-plugin-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const name of ['integrations/chatgpt-plugin', 'lib/growth/plugin-readiness.ts', 'lib/mcp/discoverability.ts', 'lib/mcp/tool-registry.json']) {
    await mkdir(resolve(root, name, '..'), { recursive: true })
    await cp(resolve(ROOT, name), resolve(root, name), { recursive: true })
  }
  return root
}

test('current package uses exact registry descriptions, scopes and annotations', async () => {
  const { manifest, mcp, registry, files } = await inputs()
  const contract = validatePackage(manifest, mcp, registry, files)
  assert.deepEqual(contract.tools.map((tool) => tool.name), Object.values(registry.tools).map((tool) => tool.name))
  for (const [index, tool] of Object.values(registry.tools).entries()) {
    assert.equal(contract.tools[index].description, tool.desc)
    assert.equal(contract.tools[index].scope, tool.scope)
    assert.deepEqual(contract.tools[index].annotations, { title: tool.title, readOnlyHint: tool.readOnly, destructiveHint: false, idempotentHint: true, openWorldHint: !tool.readOnly })
  }
  const registration = await readFile(resolve(ROOT, 'lib/mcp/tools/sites.ts'), 'utf8')
  for (const fragment of ['readOnlyHint: tool.readOnly', 'destructiveHint: false', 'idempotentHint: true', 'openWorldHint: !tool.readOnly']) assert.ok(registration.includes(fragment))
})

test('review prompts cannot name unavailable tools and OAuth scopes cannot drift', async () => {
  const { manifest, mcp, registry, files } = await inputs()
  manifest.extensions['com.openai'].review.test_cases.positive[0].tools_triggered += ', fixflags.scan_repo'
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /unavailable tool/)
  manifest.extensions['com.openai'].review.test_cases.positive[0].tools_triggered = 'fixflags.list_sites'
  mcp.mcpServers.fixflags.extensions['com.openai'].auth.baseScopes.push('admin:all')
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /scopes differ/)
  registry.tools.listSites.desc = ''
  assert.throws(() => toolContract(registry), /tool description/)
})

test('unsafe paths, escaped assets and non-square brand assets fail validation', async () => {
  for (const value of ['../secret', '/etc/passwd', './assets/../secret', './assets/%2e%2e/secret', './assets\\secret', './.env.local']) assert.throws(() => packagePath(value))
  const { manifest, mcp, registry, files } = await inputs()
  manifest.extensions['com.openai'].interface.logo = './assets/../../.env.local'
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /Unsafe package path/)
  manifest.extensions['com.openai'].interface.logo = './assets/logo.png'
  const nonSquare = Buffer.from(files.get('assets/logo.png'))
  nonSquare.writeUInt32BE(49, 16)
  files.set('assets/logo.png', nonSquare)
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /square/)
})

test('embedded credentials, headers, reviewer credentials and app mappings are rejected', async () => {
  const { manifest, mcp, registry, files } = await inputs()
  files.set('README.md', Buffer.from(`Bearer ${'a'.repeat(32)}`))
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /Credential-like/)
  files.delete('README.md')
  mcp.mcpServers.fixflags.headers = { Authorization: 'secret' }
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /unsupported field headers/)
  delete mcp.mcpServers.fixflags.headers
  manifest.extensions['com.openai'].review.test_credentials = 'secret'
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /unsupported field test_credentials/)
  delete manifest.extensions['com.openai'].review.test_credentials
  manifest.extensions['com.openai'].apps = './.app.json'
  assert.throws(() => validatePackage(manifest, mcp, registry, files), /unsupported field apps/)
})

test('build creates a reproducible extractable ZIP with an explicit file allowlist', async (t) => {
  const root = await fixture(t)
  await writeFile(resolve(root, 'integrations/chatgpt-plugin/.env.local'), 'PRIVATE=excluded')
  const first = await buildPlugin({ root })
  const archive = resolve(root, 'test-results/growth/chatgpt-plugin/fixflags-development.zip')
  const bytes = await readFile(archive)
  const second = await buildPlugin({ root })
  assert.equal(first.archiveSha256, second.archiveSha256)
  assert.deepEqual(await readFile(archive), bytes)
  assert.deepEqual(deterministicZip(new Map([['b', Buffer.from('2')], ['a', Buffer.from('1')]])), deterministicZip(new Map([['a', Buffer.from('1')], ['b', Buffer.from('2')]])))
  const names = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n')
  assert.deepEqual(names, ['README.md', 'assets/composer.png', 'assets/logo.png', 'mcp.json', 'plugin.json', 'review/tool-contract.json'])
  execFileSync('unzip', ['-t', archive])
  const archivedRegistry = JSON.parse(execFileSync('unzip', ['-p', archive, 'review/tool-contract.json'], { encoding: 'utf8' }))
  const registry = JSON.parse(await readFile(resolve(ROOT, 'lib/mcp/tool-registry.json')))
  assert.deepEqual(archivedRegistry, toolContract(registry))
  assert.equal(first.discoveryEnabled, false)
  assert.equal(first.submissionReady, false)
})

test('check mode writes nothing and submission mode fails closed on current real gate', async (t) => {
  const root = await fixture(t)
  const report = await buildPlugin({ root, check: true })
  assert.equal(report.packageValidated, true)
  await assert.rejects(readFile(resolve(root, 'test-results/growth/chatgpt-plugin/readiness.json')), /ENOENT/)
  await assert.rejects(buildPlugin({ root, submissionReady: true }), /Submission blocked:[\s\S]*discovery is disabled/)
  await assert.rejects(readFile(resolve(root, 'test-results/growth/chatgpt-plugin/fixflags-development.zip')), /ENOENT/)
})

test('changing the discovery constant alone cannot fabricate independently verified readiness', async (t) => {
  const root = await fixture(t)
  const gatePath = resolve(root, 'lib/mcp/discoverability.ts')
  const gate = await readFile(gatePath, 'utf8')
  await writeFile(gatePath, gate.replace('export const MCP_IS_DISCOVERABLE = false', 'export const MCP_IS_DISCOVERABLE = true'))
  const report = await buildPlugin({ root, check: true })
  assert.equal(report.discoveryEnabled, true)
  assert.equal(report.submissionReady, false)
  await assert.rejects(buildPlugin({ root, submissionReady: true }), /Independent live evidence required/)
})

test('symlink inputs and output directories are refused', async (t) => {
  const root = await fixture(t)
  const path = resolve(root, 'integrations/chatgpt-plugin/assets/logo.png')
  await rm(path)
  await symlink(resolve(ROOT, 'public/icon-512.png'), path)
  await assert.rejects(buildPlugin({ root }), /Symlink not allowed/)
  await rm(path)
  await cp(resolve(ROOT, 'public/icon-512.png'), path)
  const elsewhere = await mkdtemp(join(tmpdir(), 'fixflags-plugin-output-'))
  t.after(() => rm(elsewhere, { recursive: true, force: true }))
  await symlink(elsewhere, resolve(root, 'test-results'))
  await assert.rejects(buildPlugin({ root }), /Symlink output directory/)
})
