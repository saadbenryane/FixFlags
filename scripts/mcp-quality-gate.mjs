import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'lib/mcp/docs-content.ts')
const TOOLS = join(ROOT, 'lib/mcp/tools.ts')
const TASK_TOOLS = join(ROOT, 'lib/mcp/task-tools.ts')

function read(path) {
  return readFileSync(path, 'utf8')
}

function collectRegisteredToolNames(source) {
  return [...source.matchAll(/server\.tool\(\s*['"]([a-z0-9_-]+)['"]/g)].map((match) => match[1])
}

function collectCatalogToolNames(source) {
  return [...source.matchAll(/name:\s*['"]([a-z0-9_-]+)['"]/g)].map((match) => match[1])
}

function main() {
  const docs = read(DOCS)
  const toolsSource = `${read(TOOLS)}\n${read(TASK_TOOLS)}`
  const registered = [...new Set(collectRegisteredToolNames(toolsSource))]
  const catalog = [...new Set(collectCatalogToolNames(docs))]

  const errors = []
  if (registered.length < 16) {
    errors.push(`Expected at least 16 registered MCP tools, found ${registered.length}`)
  }
  if (catalog.length < 16) {
    errors.push(`Expected at least 16 tools in MCP_TOOL_DEFINITIONS, found ${catalog.length}`)
  }
  if (registered.length !== catalog.length) {
    errors.push(`Registration count (${registered.length}) diverges from catalog (${catalog.length})`)
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

  console.log(`MCP quality gate passed (${registered.length} tools registered and cataloged).`)
  console.log('Note: migrate to @modelcontextprotocol/server v2 when the stable release ships (2026-07-28 RC).')
}

main()
