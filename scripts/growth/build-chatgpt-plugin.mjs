import { createHash } from 'node:crypto'
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGE = 'integrations/chatgpt-plugin'
const OUTPUT = 'test-results/growth/chatgpt-plugin'
const SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/'
const FILES = ['plugin.json', 'mcp.json', 'README.md', 'assets/composer.png', 'assets/logo.png']
const fail = (message) => { throw new Error(message) }
const assert = (condition, message) => { if (!condition) fail(message) }
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
function keys(object, allowed, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label} must be an object`)
  for (const key of Object.keys(object)) assert(allowed.includes(key), `${label}: unsupported field ${key}`)
}
function string(value, limit, label) {
  assert(typeof value === 'string' && value.trim() && value.length <= limit && !/[\x00-\x1f\u2014]/u.test(value), `Invalid ${label}`)
}
function publicUrl(value) {
  const url = new URL(value)
  assert(url.protocol === 'https:' && url.hostname === 'fixflags.com' && !url.username && !url.password && !url.search && !url.hash, `Invalid public URL: ${value}`)
}
export function packagePath(value) {
  assert(typeof value === 'string' && value.startsWith('./') && !value.includes('\\') && !value.includes('%') && !value.includes('\0'), 'Package paths must start with ./')
  assert(!value.slice(2).split('/').some((part) => !part || part === '.' || part === '..'), `Unsafe package path: ${value}`)
  assert(FILES.includes(value.slice(2)), `Undeclared package asset: ${value}`)
  return value.slice(2)
}

export function toolContract(registry) {
  const tools = Object.values(registry.tools)
  assert(tools.length > 0 && new Set(tools.map((tool) => tool.name)).size === tools.length, 'Invalid tool registry')
  return {
    contractVersion: registry.contractVersion,
    protocolVersion: registry.protocolVersion,
    source: 'lib/mcp/tool-registry.json',
    tools: tools.map((tool) => {
      string(tool.name, 120, 'tool name')
      string(tool.desc, 2000, 'tool description')
      string(tool.title, 120, 'tool title')
      assert(typeof tool.readOnly === 'boolean', 'Missing readOnly annotation')
      assert(['sites:read', 'runs:read', 'runs:write', 'flags:read', 'flags:write'].includes(tool.scope), 'Invalid tool scope')
      return { name: tool.name, description: tool.desc, scope: tool.scope, annotations: {
        title: tool.title, readOnlyHint: tool.readOnly, destructiveHint: false,
        idempotentHint: true, openWorldHint: !tool.readOnly,
      } }
    }),
  }
}

export function validatePackage(manifest, mcp, registry, files) {
  keys(manifest, ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'keywords', 'extensions'], 'plugin')
  assert(manifest.$schema === `${SCHEMA}plugin.schema.json`, 'Use current portable plugin schema')
  assert(manifest.name === 'fixflags' && /^\d+\.\d+\.\d+$/.test(manifest.version), 'Invalid package identity')
  string(manifest.description, 4000, 'description')
  keys(manifest.author, ['name', 'email', 'url'], 'author')
  assert(manifest.author.name === 'FixFlags' && manifest.author.email === 'hello@fixflags.com', 'Publisher must match canonical brand')
  publicUrl(manifest.author.url)
  publicUrl(manifest.homepage)
  assert(Array.isArray(manifest.keywords) && manifest.keywords.every((word) => typeof word === 'string'), 'Invalid keywords')
  keys(manifest.extensions, ['com.openai'], 'extensions')
  const openai = manifest.extensions['com.openai']
  keys(openai, ['interface', 'review', 'publication'], 'OpenAI extension')
  const listing = openai.interface
  keys(listing, ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category', 'capabilities', 'websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL', 'defaultPrompt', 'composerIcon', 'logo'], 'interface')
  for (const [name, limit] of Object.entries({ displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80, category: 80 })) string(listing[name], limit, name)
  for (const name of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) publicUrl(listing[name])
  assert(Array.isArray(listing.capabilities) && listing.capabilities.length <= 20, 'Invalid capabilities')
  listing.capabilities.forEach((value) => string(value, 120, 'capability'))
  assert(Array.isArray(listing.defaultPrompt) && listing.defaultPrompt.length <= 3, 'Invalid prompts')
  listing.defaultPrompt.forEach((value) => string(value, 128, 'starter prompt'))
  for (const name of ['composerIcon', 'logo']) {
    const buffer = files.get(packagePath(listing[name]))
    assert(buffer && buffer.length <= 5 * 1024 * 1024 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG asset')
    const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20)
    assert(width === height && width >= 48 && width <= 4096, 'Icon must be square and 48..4096 pixels')
  }
  keys(openai.review, ['test_cases', 'commerce', 'commerce_description'], 'review')
  keys(openai.review.test_cases, ['positive', 'negative'], 'test cases')
  const names = new Set(toolContract(registry).tools.map((tool) => tool.name))
  for (const [kind, count] of [['positive', 5], ['negative', 3]]) {
    const cases = openai.review.test_cases[kind]
    assert(Array.isArray(cases) && cases.length === count, `Require ${count} ${kind} cases`)
    for (const testCase of cases) {
      keys(testCase, ['description', 'prompt', 'tools_triggered', 'expected_behavior'], 'review case')
      for (const name of ['description', 'prompt', 'expected_behavior']) string(testCase[name], 4000, name)
      assert(typeof testCase.tools_triggered === 'string', 'Missing expected tools')
      const tools = testCase.tools_triggered.split(',').map((name) => name.trim()).filter(Boolean)
      if (kind === 'positive') assert(tools.length > 0, 'Positive case requires tools')
      for (const name of tools) assert(names.has(name), `Review case references an unavailable tool: ${name}`)
    }
  }
  assert(openai.review.commerce === false, 'Package must not introduce commerce')
  string(openai.review.commerce_description, 4000, 'commerce description')
  keys(openai.publication, ['release_notes'], 'publication')
  string(openai.publication.release_notes, 4000, 'release notes')
  keys(mcp, ['$schema', 'mcpServers'], 'MCP')
  assert(mcp.$schema === `${SCHEMA}mcp.schema.json`, 'Use current portable MCP schema')
  keys(mcp.mcpServers, ['fixflags'], 'MCP servers')
  const server = mcp.mcpServers.fixflags
  keys(server, ['type', 'url', 'extensions'], 'MCP server')
  assert(server.type === 'streamable-http' && server.url === 'https://fixflags.com/api/mcp', 'MCP must use existing canonical endpoint')
  keys(server.extensions, ['com.openai'], 'MCP extensions')
  keys(server.extensions['com.openai'], ['auth'], 'MCP OpenAI extension')
  const auth = server.extensions['com.openai'].auth
  keys(auth, ['type', 'client', 'baseScopes'], 'MCP auth')
  keys(auth.client, ['mode'], 'OAuth client')
  assert(auth.type === 'oauth' && auth.client.mode === 'dcr', 'Use existing OAuth DCR')
  const scopes = [...new Set(Object.values(registry.tools).map((tool) => tool.scope))].sort()
  assert(JSON.stringify([...auth.baseScopes].sort()) === JSON.stringify(scopes), 'OAuth scopes differ from registry')
  for (const [name, buffer] of files) {
    assert(FILES.includes(name), `Unexpected package file: ${name}`)
    if (name.endsWith('.png')) continue
    assert(!/(?:ff_live_[A-Za-z0-9]{12,}|(?:sk|rk)-(?:live|test|proj)-[A-Za-z0-9_-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._-]{16,})/u.test(buffer.toString()), `Credential-like material in ${name}`)
  }
  return toolContract(registry)
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
/** Stored ZIP, fixed DOS date (1980-01-01), sorted names, no filesystem metadata. */
export function deterministicZip(files) {
  const local = [], central = []
  let offset = 0
  for (const [name, data] of [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    assert(!isAbsolute(name) && !name.split('/').includes('..') && !name.includes('\\'), 'Unsafe ZIP entry')
    const filename = Buffer.from(name), crc = crc32(data)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6)
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26)
    local.push(header, filename, data)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x800, 8)
    entry.writeUInt16LE(33, 14); entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42)
    central.push(entry, filename); offset += header.length + filename.length + data.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

export async function buildPlugin({ root = ROOT, check = false, submissionReady = false } = {}) {
  const files = new Map()
  for (const name of FILES) {
    const path = resolve(root, PACKAGE, name)
    // Reject symlinks in every component, including directories above an asset.
    for (let component = path; component !== root; component = dirname(component)) {
      assert(!relative(root, component).startsWith('..'), 'Package file escapes repository')
      assert(!(await lstat(component)).isSymbolicLink(), `Symlink not allowed: ${relative(root, component)}`)
    }
    assert((await lstat(path)).isFile(), `Package file is not regular: ${name}`)
    files.set(name, await readFile(path))
  }
  const manifest = JSON.parse(files.get('plugin.json'))
  const mcp = JSON.parse(files.get('mcp.json'))
  const registry = JSON.parse(await readFile(resolve(root, 'lib/mcp/tool-registry.json'), 'utf8'))
  const contract = validatePackage(manifest, mcp, registry, files)
  const { inspectChatgptPluginReadiness } = await import(pathToFileURL(resolve(root, 'lib/growth/plugin-readiness.ts')).href)
  const gate = await import(pathToFileURL(resolve(root, 'lib/mcp/discoverability.ts')).href)
  const readiness = inspectChatgptPluginReadiness({ enabled: gate.MCP_IS_DISCOVERABLE, requirements: gate.MCP_DISCOVERY_EVIDENCE })
  assert(!submissionReady || readiness.submissionReady, `Submission blocked:\n${readiness.blockers.join('\n')}`)
  files.set('review/tool-contract.json', json(contract))
  const archive = deterministicZip(files)
  const report = {
    mode: 'development-preparation', packageValidated: true, ...readiness,
    archiveSha256: sha256(archive),
    files: [...files].map(([name, data]) => ({ name, sha256: sha256(data), bytes: data.length })),
    validationBoundary: 'Local package contract only. No live connection, authorization, recovery, reviewer execution, submission or publication is proven.',
  }
  if (!check) {
    const output = resolve(root, OUTPUT)
    // Output is fixed beneath the ignored directory; never follow a redirected output tree.
    for (const name of ['test-results', 'test-results/growth', OUTPUT]) {
      const path = resolve(root, name)
      await mkdir(path, { recursive: true })
      assert(!(await lstat(path)).isSymbolicLink(), 'Symlink output directory refused')
    }
    for (const [name, bytes] of [['fixflags-development.zip', archive], ['readiness.json', json(report)]]) {
      const path = resolve(output, name)
      const stat = await lstat(path).catch((error) => { if (error.code === 'ENOENT') return null; throw error })
      assert(!stat || (stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1), 'Unsafe output file')
      await writeFile(path, bytes)
    }
  }
  return report
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  try {
    assert(args.every((arg) => ['--check', '--submission-ready'].includes(arg)), 'Unknown argument. Use --check or --submission-ready.')
    console.log(JSON.stringify(await buildPlugin({ check: args.includes('--check'), submissionReady: args.includes('--submission-ready') }), null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
