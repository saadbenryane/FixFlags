import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'lib/mcp/docs-content.ts')
const MANIFEST = join(ROOT, 'lib/mcp/tool-manifest.ts')
const TOOL_DIR = join(ROOT, 'lib/mcp/tools')
const TASK_TOOLS = join(ROOT, 'lib/mcp/task-tools.ts')

function read(path) {
  return readFileSync(path, 'utf8')
}

function collectManifest(source) {
  return new Map(
    [...source.matchAll(/^\s{2}([a-zA-Z0-9]+):\s*\{\s*\n\s*name:\s*['"]([a-z0-9_-]+)['"]/gm)]
      .map((match) => [match[1], match[2]])
  )
}

function collectRegisteredToolKeys(source) {
  return [...source.matchAll(/server\.tool\(\s*MCP_TOOLS\.([a-zA-Z0-9]+)\.name/g)]
    .map((match) => match[1])
}

function main() {
  const docs = read(DOCS)
  const manifest = collectManifest(read(MANIFEST))
  const toolsSource = [
    read(TASK_TOOLS),
    ...readdirSync(TOOL_DIR)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => read(join(TOOL_DIR, file))),
  ].join('\n')
  const registeredKeys = collectRegisteredToolKeys(toolsSource)
  const registered = registeredKeys.map((key) => manifest.get(key)).filter(Boolean)
  const catalog = [...manifest.values()]

  const errors = []
  if (!docs.includes("from '@/lib/mcp/tool-manifest'")) {
    errors.push('MCP documentation does not consume the canonical tool manifest')
  }
  if (manifest.size !== 18) {
    errors.push(`Expected 18 tools in the MCP manifest, found ${manifest.size}`)
  }
  if (registered.length !== catalog.length) {
    errors.push(`Registration count (${registered.length}) diverges from catalog (${catalog.length})`)
  }
  const duplicateKeys = registeredKeys.filter((key, index) => registeredKeys.indexOf(key) !== index)
  for (const key of new Set(duplicateKeys)) errors.push(`MCP tool registered more than once: ${key}`)
  for (const key of registeredKeys) {
    if (!manifest.has(key)) errors.push(`Registered MCP key missing from manifest: ${key}`)
  }

  const registeredSet = new Set(registered)
  const catalogSet = new Set(catalog)
  for (const name of registered) {
    if (!catalogSet.has(name)) errors.push(`Registered MCP tool missing from catalog: ${name}`)
  }
  for (const name of catalog) {
    if (!registeredSet.has(name)) errors.push(`Catalog MCP tool missing from registration: ${name}`)
  }

  const required = [
    'ff_check_and_plan',
    'ff_recheck_and_compare',
    'ff_get_product_context',
    'generate-fix-prompt',
  ]
  for (const name of required) {
    if (!registeredSet.has(name)) errors.push(`Missing required registered MCP tool: ${name}`)
    if (!catalogSet.has(name)) errors.push(`Missing required MCP tool in catalog: ${name}`)
  }

  if (errors.length) {
    console.error('MCP quality gate failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(`MCP quality gate passed (${registered.length} typed tools registered and cataloged).`)
  console.log('Note: migrate to @modelcontextprotocol/server v2 when the stable release ships (2026-07-28 RC).')
}

main()
