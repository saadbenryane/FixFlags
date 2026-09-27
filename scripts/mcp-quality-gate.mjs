import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const registry = JSON.parse(readFileSync(join(ROOT, 'lib/mcp/tool-registry.json'), 'utf8'))
const docs = readFileSync(join(ROOT, 'lib/mcp/docs-content.ts'), 'utf8')
const registrations = readFileSync(join(ROOT, 'lib/mcp/tools/index.ts'), 'utf8')

const expectedNames = [
  'fixflags.list_sites',
  'fixflags.list_outcomes',
  'fixflags.run',
  'fixflags.get_run',
  'fixflags.list_flags',
  'fixflags.get_flag',
  'fixflags.record_fix',
  'fixflags.verify_flag',
  'fixflags.get_connection_info',
]
const expectedScopes = new Set(['sites:read', 'runs:read', 'runs:write', 'flags:read', 'flags:write'])
const tools = Object.values(registry.tools)
const errors = []

if (registry.protocolVersion !== '2026-07-28') errors.push('Protocol version is not 2026-07-28')
if (JSON.stringify(tools.map((tool) => tool.name)) !== JSON.stringify(expectedNames)) {
  errors.push('Public MCP registry is not the exact launch tool surface')
}
if (new Set(tools.map((tool) => tool.name)).size !== tools.length) errors.push('Public MCP tool names are not unique')
for (const tool of tools) {
  if (!expectedScopes.has(tool.scope)) errors.push(`Invalid MCP scope for ${tool.name}: ${tool.scope}`)
  if (!tool.desc || !tool.title || typeof tool.readOnly !== 'boolean') errors.push(`Incomplete MCP definition: ${tool.name}`)
}
if (!docs.includes("from '@/lib/mcp/tool-manifest'")) errors.push('MCP documentation does not consume the registry')
if (!registrations.includes('registerSiteOutcomeTools') || !registrations.includes('registerConnectionInfoTool')) {
  errors.push('Public MCP registration is not routed through the Site/Outcome registry adapters')
}
if (/register(?:Task|Flag|RepoScan|CheckStatus|Compare|PromptGenerator)Tools/.test(registrations)) {
  errors.push('A report-era or parked MCP module is publicly registered')
}

if (errors.length) {
  console.error('MCP quality gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`MCP quality gate passed (${tools.length} registry-defined Site tools; ${registry.protocolVersion}).`)
