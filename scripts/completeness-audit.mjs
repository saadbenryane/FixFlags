import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

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
  return [...source.matchAll(/server\.(?:tool|registerTool)\(\s*MCP_TOOLS\.([a-zA-Z0-9]+)\.name/g)]
    .map((match) => match[1])
}

const GENERATED_ARTIFACT_PATTERN = /(^|\/)(?:node_modules|dist|\.cache|coverage|\.next(?:-[^/]*)?|output|playwright-report|test-results)(?:\/|$)/

export function collectTrackedGeneratedArtifacts(files) {
  return files.filter((file) => GENERATED_ARTIFACT_PATTERN.test(file))
}

export function railwayUsesStrictReadiness(source) {
  return /^healthcheckPath\s*=\s*["']\/api\/health\/ready["']\s*$/m.test(source)
}

export function criticalRouteBoundaryFailures(routes, maxLines = 160) {
  const failures = []
  for (const [file, source] of Object.entries(routes)) {
    const lineCount = source.split(/\r?\n/).length
    if (lineCount > maxLines) failures.push(`${file} exceeds ${maxLines} lines (${lineCount})`)
    if (/(?:from\s+|import\s*\()["'](?:@\/lib\/db|@prisma\/client)["']/.test(source)) {
      failures.push(`${file} imports persistence directly`)
    }
  }
  return failures
}

function parseTsx(source) {
  const sourceFile = ts.createSourceFile(
    'AuditReport.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  return sourceFile.parseDiagnostics.length === 0 ? sourceFile : null
}

function jsxTagName(node) {
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText()
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText()
  return null
}

function collectDescendants(node, predicate) {
  const matches = []
  const visit = (child) => {
    if (predicate(child)) matches.push(child)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return matches
}

function jsxAttributes(node) {
  if (ts.isJsxSelfClosingElement(node)) return node.attributes.properties
  if (ts.isJsxElement(node)) return node.openingElement.attributes.properties
  return []
}

function getJsxAttribute(node, name) {
  return jsxAttributes(node).find(
    (attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText() === name,
  )
}

function jsxAttributeExpression(node, name) {
  const attribute = getJsxAttribute(node, name)
  return attribute && ts.isJsxExpression(attribute.initializer)
    ? attribute.initializer.expression ?? null
    : null
}

function buildVariableInitializers(sourceFile) {
  const variables = new Map()
  for (const declaration of collectDescendants(sourceFile, ts.isVariableDeclaration)) {
    if (ts.isIdentifier(declaration.name) && declaration.initializer) {
      variables.set(declaration.name.text, declaration.initializer)
    }
  }
  return variables
}

function resolveExpression(expression, variables, seen = new Set()) {
  let current = expression
  while (current && ts.isParenthesizedExpression(current)) current = current.expression
  if (!current || !ts.isIdentifier(current) || seen.has(current.text)) return current
  const initializer = variables.get(current.text)
  if (!initializer) return current
  seen.add(current.text)
  return resolveExpression(initializer, variables, seen)
}

function hasLiteralId(node, expected) {
  return collectDescendants(node, (child) => {
    if (!ts.isJsxAttribute(child) || child.name.getText() !== 'id') return false
    return ts.isStringLiteral(child.initializer) && child.initializer.text === expected
  }).length > 0
}

function containsComponent(node, name) {
  return collectDescendants(node, (child) => jsxTagName(child) === name)
}

/**
 * Inspect the rendered dependency graph, not a particular JSX spelling:
 * every workspace shell must resolve to ReportOutcomeBar + ReportPane; the
 * pane must resolve to the complete Flag explorer. Product context lives on
 * the Product page, not in a Report disclosure.
 */
export function reportPaneCompositionIsCanonical(source) {
  const sourceFile = parseTsx(source)
  if (!sourceFile) return false
  const variables = buildVariableInitializers(sourceFile)
  const shells = collectDescendants(
    sourceFile,
    (node) => jsxTagName(node) === 'ReportWorkspaceSplitShell',
  )
  if (shells.length === 0) return false

  return shells.every((shell) => {
    const header = resolveExpression(jsxAttributeExpression(shell, 'reportHeader'), variables)
    const panel = resolveExpression(jsxAttributeExpression(shell, 'reportPanel'), variables)
    if (!header || !panel) return false

    const outcomeBars = containsComponent(header, 'ReportOutcomeBar')
    if (outcomeBars.length !== 1) return false
    const outcomeModel = jsxAttributeExpression(outcomeBars[0], 'model')
    if (!outcomeModel || !ts.isIdentifier(outcomeModel) || outcomeModel.text !== 'workspace') {
      return false
    }

    const panes = containsComponent(panel, 'ReportPane')
    if (panes.length !== 1) return false
    const pane = panes[0]
    const explorer = resolveExpression(jsxAttributeExpression(pane, 'explorer'), variables)
    if (!explorer || !hasLiteralId(explorer, 'report-flags')) return false

    const afterFrame = resolveExpression(jsxAttributeExpression(pane, 'afterFrame'), variables)
    const disclosures = afterFrame
      ? containsComponent(afterFrame, 'ReportContextDisclosure')
      : []
    return disclosures.length === 0
  })
}

export function curatedSampleBundleFailures(root) {
  const failures = []
  const manifestPath = path.join(root, 'lib/marketing/sample-evidence-anchors.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return ['Curated sample capture manifest is missing or invalid JSON']
  }
  if (manifest.schemaVersion !== 1) failures.push('Curated sample capture manifest schemaVersion must be 1')
  if (manifest.generatedBy !== 'scripts/capture-sample-screenshots.ts') {
    failures.push('Curated sample capture manifest must name its repository generator')
  }
  const observations = Object.entries(manifest.observations ?? {})
  if (observations.length === 0) failures.push('Curated sample capture manifest has no observations')
  const hashesByDevice = { desktop: new Set(), mobile: new Set() }
  for (const [id, observation] of observations) {
    for (const field of ['revision', 'sourcePath', 'reviewedAt', 'documentSha256']) {
      if (typeof observation[field] !== 'string' || observation[field].length === 0) {
        failures.push(`${id} is missing ${field}`)
      }
    }
    if (!Array.isArray(observation.flagIds) || !Array.isArray(observation.timeline) || observation.timeline.length === 0) {
      failures.push(`${id} is missing complete Flag or Timeline data`)
    }
    if (typeof observation.score !== 'number' || !observation.anchors || typeof observation.anchors !== 'object') {
      failures.push(`${id} is missing score or evidence-anchor data`)
    }
    for (const device of ['desktop', 'mobile']) {
      const capture = observation.captures?.[device]
      const capturePath = capture?.path?.replace(/^\//, '')
      const absolute = capturePath ? path.join(root, 'public', capturePath.replace(/^samples\//, 'samples/')) : ''
      if (!capturePath || !absolute || !existsSync(absolute)) {
        failures.push(`${id} is missing its ${device} capture`)
        continue
      }
      const actualHash = createHash('sha256').update(readFileSync(absolute)).digest('hex')
      if (actualHash !== capture.sha256) failures.push(`${id} ${device} capture hash does not match the manifest`)
      if (!Number.isInteger(capture.width) || !Number.isInteger(capture.height)) {
        failures.push(`${id} ${device} capture dimensions are missing`)
      }
      hashesByDevice[device].add(capture.sha256)
    }
  }
  if (observations.length > 1) {
    for (const device of ['desktop', 'mobile']) {
      if (hashesByDevice[device].size !== observations.length) {
        failures.push(`Published sample observations reuse a materially identical ${device} capture`)
      }
    }
  }
  const sampleRoute = read(root, 'app/(marketing)/samples/page.tsx')
  if (!sampleRoute.includes('UnknownCuratedObservationError') || !sampleRoute.includes('notFound()')) {
    failures.push('Explicit unknown sample observations must fail closed with notFound')
  }
  return failures
}

export function runCompletenessAudit(root = DEFAULT_ROOT) {
  const failures = []
  const assert = (condition, message) => { if (!condition) failures.push(message) }

  const schema = read(root, 'prisma/schema.prisma')
  const modelCount = (schema.match(/^model /gm) ?? []).length
  assert(modelCount > 0, 'Prisma schema has no models')

  const reportShell = read(root, 'components/audit/AuditReport.tsx')
  const reportSources = [
    'components/audit/AuditReport.tsx',
    'components/audit/AuditReportProgressive.tsx',
    'components/report/ReportFinishPlan.tsx',
    'components/audit/ProductMemoryStrip.tsx',
    'components/audit/RecheckDiffStrip.tsx',
    'components/audit/LaunchGates.tsx',
  ].map((file) => read(root, file)).join('\n')
  // Report pane order: outcome header → shared pane/explorer. Product context is on the Product page.
  assert(
    reportPaneCompositionIsCanonical(reportShell),
    'Report pane order must be outcome bar → complete Flag list, with no Review context disclosure',
  )
  for (const failure of curatedSampleBundleFailures(root)) assert(false, failure)

  assert(schema.includes('canonicalHost') && schema.includes('isManaged'), 'Product identity schema is missing canonicalHost/isManaged')
  assert(schema.includes('productIntelligenceRevision'), 'Product Intelligence revision is missing')
  for (const model of ['Improvement', 'ImprovementOccurrence', 'ImprovementAttempt', 'ProductRelease', 'ProductSignal', 'ProductSignalKey']) {
    assert(schema.includes(`model ${model} {`), `Continuous improvement schema is missing ${model}`)
  }
  assert(
    schema.includes('enum VerificationOutcome') &&
      ['IMPROVED', 'UNCHANGED', 'REGRESSED', 'INCONCLUSIVE'].every((value) => schema.includes(`  ${value}`)),
    'Independent verification outcome contract drifted',
  )
  const graphRoot = path.join(root, 'lib/graph')
  const graphSources = readdirSync(graphRoot, { recursive: true })
    .filter((file) => typeof file === 'string' && file.endsWith('.ts'))
    .map((file) => readFileSync(path.join(graphRoot, file), 'utf8'))
    .join('\n')
  assert(
    !/prisma\.(?:improvement|improvementAttempt|improvementOccurrence)|productIntelligence/.test(graphSources),
    'Growth graph reads private customer Improvements or Product Memory',
  )
  const signalClient = read(root, 'public/fixflags.js')
  for (const forbidden of ['location.search', 'innerText', 'outerHTML', 'event.target', 'document.cookie']) {
    assert(!signalClient.includes(forbidden), `Product Signal client captures forbidden data: ${forbidden}`)
  }
  assert(schema.includes('model ShareLink'), 'Legacy ShareLink model missing; leftover token reads still need it')
  assert(!read(root, 'app/api/projects/route.ts').includes('isAnchor'), 'Managed quota still uses isAnchor')
  assert(!read(root, 'components/audit/ExportMenu.tsx').includes('limit: null'), 'Finish Plan still uses limit:null')

  const unifiedFixListConsumers = ['lib/audit/task-contracts.ts']
  for (const file of unifiedFixListConsumers) {
    assert(
      read(root, file).includes('buildUnifiedFixList') ||
        read(root, file).includes('buildUnifiedPlanBundle') ||
        read(root, file).includes('loadCompletedTaskOutcome'),
      `Canonical complete Fix List loader missing from ${file}`,
    )
  }
  assert(
    !read(root, 'app/report/[id]/load-report-route-state.ts').includes('loadFinishPlanFlags'),
    'URL reports must not merge repository findings into their Flag list',
  )
  assert(
    !read(root, 'components/audit/ExportMenu.tsx').includes('buildFinishPlan'),
    'Primary report export still depends on the legacy three-item Finish Plan',
  )

  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file && existsSync(path.join(root, file)))
  const clutter = collectTrackedGeneratedArtifacts(tracked)
  assert(clutter.length === 0, `Tracked generated dependencies/artifacts: ${clutter.slice(0, 5).join(', ')}`)
  assert(
    railwayUsesStrictReadiness(read(root, 'railway.toml')),
    'Railway web deployment must gate on /api/health/ready',
  )
  const criticalRoutes = [
    'app/api/reports/[id]/chat/route.ts',
    'app/api/webhooks/stripe/route.ts',
  ]
  const criticalRouteFailures = criticalRouteBoundaryFailures(
    Object.fromEntries(criticalRoutes.map((file) => [file, read(root, file)])),
  )
  for (const failure of criticalRouteFailures) assert(false, failure)

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
    facts: {
      modelCount,
      renderedReportSectionCount: new Set(
        [...reportSources.matchAll(/\bid=["'](report-[a-z0-9-]+)["']/g)].map((match) => match[1]),
      ).size,
    },
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runCompletenessAudit()
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`)
    process.exitCode = 1
  } else {
    console.log(`PASS completeness audit: ${result.facts.modelCount} models, ${result.facts.renderedReportSectionCount} rendered report sections; parked power tools verify separately`)
  }
}
