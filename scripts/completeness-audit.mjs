import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (root, file) => readFileSync(path.join(root, file), 'utf8')

export function collectMcpTools(source) {
  return [...source.matchAll(/server\.tool\(\s*['"]([a-z0-9_-]+)['"]/g)].map((match) => match[1])
}

export function collectMcpToolManifest(source) {
  return new Map(
    [...source.matchAll(/^\s{2}([a-zA-Z0-9]+):\s*\{\s*\n\s*name:\s*['"]([a-z0-9_-]+)['"]/gm)]
      .map((match) => [match[1], match[2]])
  )
}

export function collectRegisteredMcpToolKeys(source) {
  return [...source.matchAll(/server\.tool\(\s*MCP_TOOLS\.([a-zA-Z0-9]+)\.name/g)]
    .map((match) => match[1])
}

function mcpRegistrationSource(root) {
  const toolDir = path.join(root, 'lib/mcp/tools')
  const moduleFiles = readdirSync(toolDir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => path.join(toolDir, file))
  return [
    path.join(root, 'lib/mcp/task-tools.ts'),
    ...moduleFiles,
  ].map((file) => readFileSync(file, 'utf8')).join('\n')
}

export function runCompletenessAudit(root = DEFAULT_ROOT) {
  const failures = []
  const assert = (condition, message) => { if (!condition) failures.push(message) }

  const schema = read(root, 'prisma/schema.prisma')
  const modelCount = (schema.match(/^model /gm) ?? []).length
  assert(modelCount > 0, 'Prisma schema has no models')

  const manifest = collectMcpToolManifest(read(root, 'lib/mcp/tool-manifest.ts'))
  const registeredKeys = collectRegisteredMcpToolKeys(mcpRegistrationSource(root))
  const duplicateKeys = registeredKeys.filter((key, index) => registeredKeys.indexOf(key) !== index)
  const unknownKeys = registeredKeys.filter((key) => !manifest.has(key))
  const missingKeys = [...manifest.keys()].filter((key) => !registeredKeys.includes(key))
  const tools = [...manifest.values()]
  assert(manifest.size === 17, `MCP tool manifest drift: expected=17, code=${manifest.size}`)
  assert(duplicateKeys.length === 0, `MCP tools registered more than once: ${[...new Set(duplicateKeys)].join(', ')}`)
  assert(unknownKeys.length === 0, `MCP registrations absent from manifest: ${[...new Set(unknownKeys)].join(', ')}`)
  assert(missingKeys.length === 0, `MCP manifest tools not registered: ${missingKeys.join(', ')}`)
  assert(
    read(root, 'lib/mcp/docs-content.ts').includes("from '@/lib/mcp/tool-manifest'"),
    'MCP documentation does not consume the canonical tool manifest',
  )

  const integrationFiles = [
    'fixflags-cli/src/index.ts',
    'fixflags-cli/src/workflows.ts',
    'lib/help/catalog.ts',
    'lib/marketing/copy.ts',
    'lib/mcp/docs-content.ts',
    'ide-integrations/README.md',
    'ide-integrations/cursor/fixflags.mdc',
    'ide-integrations/claude-code/fixflags-skill.md',
    'ide-integrations/kiro/fixflags-power.md',
  ]
  const integrationText = integrationFiles.map((file) => read(root, file)).join('\n')
  for (const stale of ['ff_check_url', 'ff_monitoring']) {
    assert(!integrationText.includes(stale), `Obsolete MCP tool reference: ${stale}`)
  }
  for (const canonical of ['ff_check_and_plan', 'ff_recheck_and_compare']) {
    assert(tools.includes(canonical), `Canonical MCP tool is not registered: ${canonical}`)
    assert(integrationText.includes(canonical), `Canonical MCP tool is absent from integrations: ${canonical}`)
  }
  assert(!read(root, 'fixflags-cli/src/index.ts').includes(".alias('scan')"), 'Unpublished CLI scan alias is still registered')
  assert(!read(root, 'fixflags-cli/README.md').includes('fixflags scan '), 'CLI README still documents scan')

  const toolbar = read(root, 'components/audit/ReportStickyToolbar.tsx')
  const reportSources = [
    'components/audit/AuditReport.tsx',
    'components/audit/AuditReportProgressive.tsx',
    'components/audit/ProductMemoryStrip.tsx',
    'components/audit/RecheckDiffStrip.tsx',
    'components/audit/FlowScanTimeline.tsx',
    'components/audit/PreviewCards.tsx',
    'components/audit/LaunchGates.tsx',
  ].map((file) => read(root, file)).join('\n')
  const sectionIds = [...toolbar.matchAll(/id:\s*['"]([^'"]+)['"]/g)].map((match) => match[1])
  for (const sectionId of sectionIds) {
    assert(reportSources.includes(`id="${sectionId}"`) || reportSources.includes(`id={${sectionId}`), `Sticky destination has no report section: ${sectionId}`)
  }

  assert(schema.includes('canonicalHost') && schema.includes('isManaged'), 'Product identity schema is missing canonicalHost/isManaged')
  assert(schema.includes('productIntelligenceRevision'), 'Product Intelligence revision is missing')
  assert(schema.includes('passwordHash') && !/model ShareLink[\s\S]*?\n\}/.exec(schema)?.[0].includes('password     '), 'ShareLink passwordHash contract drift')
  assert(!read(root, 'app/api/projects/route.ts').includes('isAnchor'), 'Managed quota still uses isAnchor')
  assert(!read(root, 'components/audit/ExportMenu.tsx').includes('limit: null'), 'Finish Plan still uses limit:null')

  const unifiedFixListConsumers = [
    'lib/audit/task-contracts.ts',
    'lib/mcp/tools/flags.ts',
  ]
  for (const file of unifiedFixListConsumers) {
    assert(
      read(root, file).includes('buildUnifiedFixList') ||
        read(root, file).includes('buildUnifiedPlanBundle'),
      `Canonical complete Fix List loader missing from ${file}`,
    )
  }
  assert(
    read(root, 'app/report/[id]/load-report-route-state.ts').includes('loadFinishPlanFlags'),
    'Canonical report does not load the shared live and repository Flag set',
  )
  assert(
    !read(root, 'components/audit/ExportMenu.tsx').includes('buildFinishPlan'),
    'Primary report export still depends on the legacy three-item Finish Plan',
  )

  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n')
  const clutter = tracked.filter((file) => /(^|\/)node_modules\//.test(file) || /(^|\/)dist\//.test(file))
  assert(clutter.length === 0, `Tracked generated dependencies/artifacts: ${clutter.slice(0, 5).join(', ')}`)

  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\n')
  const productionFiles = [...new Set([...tracked, ...untracked])].filter((file) =>
    existsSync(path.join(root, file)) &&
    (/^(app|components|lib|worker)\/.+\.(?:ts|tsx)$/.test(file) ||
      /^(instrumentation|middleware|proxy)\.ts$/.test(file)),
  )
  const scriptImports = productionFiles.filter((file) => {
    const source = read(root, file)
    return /(?:from\s+|import\s*\()['"](?:@\/|\.\.\/)+scripts\//.test(source)
  })
  assert(
    scriptImports.length === 0,
    `Production modules import development scripts: ${scriptImports.slice(0, 5).join(', ')}`,
  )

  return {
    ok: failures.length === 0,
    failures,
    facts: { modelCount, mcpToolCount: manifest.size, sectionCount: sectionIds.length },
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runCompletenessAudit()
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`)
    process.exitCode = 1
  } else {
    console.log(`PASS completeness audit: ${result.facts.modelCount} models, ${result.facts.mcpToolCount} MCP tools, ${result.facts.sectionCount} sticky destinations`)
  }
}
