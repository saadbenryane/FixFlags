import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS = join(ROOT, 'lib/mcp/docs-content.ts')
const TOOLS = join(ROOT, 'lib/mcp/tools.ts')
const TASK_TOOLS = join(ROOT, 'lib/mcp/task-tools.ts')

function read(path) {
  return readFileSync(path, 'utf8')
}

function countToolRegistrations(source) {
  return (source.match(/server\.tool\(/g) ?? []).length
}

function main() {
  const docs = read(DOCS)
  const registered =
    countToolRegistrations(read(TOOLS)) + countToolRegistrations(read(TASK_TOOLS))
  const catalogMatches = docs.match(/name: '([^']+)'/g) ?? []
  const catalogCount = catalogMatches.length

  const errors = []
  if (registered < 16) {
    errors.push(`Expected at least 16 registered MCP tools, found ${registered}`)
  }
  if (catalogCount < 16) {
    errors.push(`Expected at least 16 tools in MCP_TOOL_DEFINITIONS, found ${catalogCount}`)
  }
  if (Math.abs(registered - catalogCount) > 1) {
    errors.push(`Registration count (${registered}) diverges from catalog (${catalogCount})`)
  }

  const required = [
    'ff_check_and_plan',
    'ff_recheck_and_compare',
    'ff_get_product_context',
    'generate-fix-prompt',
  ]
  for (const name of required) {
    if (!docs.includes(name)) errors.push(`Missing required MCP tool in catalog: ${name}`)
  }

  if (errors.length) {
    console.error('MCP quality gate failed:')
    for (const error of errors) console.error(`- ${error}`)
    process.exit(1)
  }

  console.log(`MCP quality gate passed (${registered} tools registered, ${catalogCount} cataloged).`)
  console.log('Note: migrate to @modelcontextprotocol/server v2 when the stable release ships (2026-07-28 RC).')
}

main()
