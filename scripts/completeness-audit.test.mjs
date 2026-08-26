import test from 'node:test'
import assert from 'node:assert/strict'
import {
  collectMcpToolManifest,
  collectMcpTools,
  collectRegisteredMcpToolKeys,
  collectTrackedGeneratedArtifacts,
  criticalRouteBoundaryFailures,
  curatedSampleBundleFailures,
  reportPaneCompositionIsCanonical,
  railwayUsesStrictReadiness,
  runCompletenessAudit,
} from './completeness-audit.mjs'

test('collectMcpTools extracts registered names without prose references', () => {
  assert.deepEqual(collectMcpTools("server.tool(\n 'ff_one', x)\n// ff_fake\nserver.tool('generate-two', y)"), ['ff_one', 'generate-two'])
})

test('Report pane composition guard follows resolved component structure', () => {
  const source = `
    const flagsSection = condition
      ? <section className="whatever" id="report-flags"><LiveReportExplorer /></section>
      : <section id="report-flags" />
    const livingReportPanel = (
      <ReportPane
        explorer={flagsSection}
        beforeExplorer={frameExtras}
      />
    )
    return (
      <ReportWorkspaceSplitShell
        reportPanel={livingReportPanel}
        reportHeader={<ReportOutcomeBar progress={progress} model={workspace} />}
      />
    )
  `
  assert.equal(reportPaneCompositionIsCanonical(source), true)
  assert.equal(
    reportPaneCompositionIsCanonical(
      source.replace(
        'explorer={flagsSection}',
        'explorer={flagsSection} afterFrame={<ReportContextDisclosure />}',
      ),
    ),
    false,
  )
  assert.equal(reportPaneCompositionIsCanonical(source.replaceAll('id="report-flags"', 'id="other"')), false)
  assert.equal(reportPaneCompositionIsCanonical(source.replace('model={workspace}', 'model={other}')), false)
})

test('Report pane composition guard rejects malformed TSX instead of matching fragments', () => {
  assert.equal(
    reportPaneCompositionIsCanonical(`
      <ReportWorkspaceSplitShell reportHeader={<ReportOutcomeBar model={workspace} />}
      const text = '<ReportFinishPlan /><ReportContextDisclosure />'
    `),
    false,
  )
})

test('repository sample bundle has complete distinct hashed captures', () => {
  assert.deepEqual(curatedSampleBundleFailures(process.cwd()), [])
})

test('typed MCP manifest and registrations expose stable keys', () => {
  const manifest = collectMcpToolManifest(`export const MCP_TOOLS = {
  checkAndPlan: {
    name: 'ff_check_and_plan',
    desc: 'Check.',
  },
} as const`)
  assert.deepEqual([...manifest], [['checkAndPlan', 'ff_check_and_plan']])
  assert.deepEqual(
    collectRegisteredMcpToolKeys(`
      server.tool(MCP_TOOLS.checkAndPlan.name, MCP_TOOLS.checkAndPlan.desc, {})
      server.registerTool(MCP_TOOLS.getConnectionInfo.name, {})
    `),
    ['checkAndPlan', 'getConnectionInfo'],
  )
})

test('tracked generated clutter covers build and browser artifacts', () => {
  assert.deepEqual(collectTrackedGeneratedArtifacts([
    'lib/source.ts',
    '.cache/eslint/changed',
    'coverage/index.html',
    '.next/server/app.js',
    '.next-verify/server/app.js',
    'output/report.json',
    'playwright-report/index.html',
    'test-results/failure.png',
    'fixflags-cli/dist/index.js',
    'node_modules/pkg/index.js',
  ]), [
    '.cache/eslint/changed',
    'coverage/index.html',
    '.next/server/app.js',
    '.next-verify/server/app.js',
    'output/report.json',
    'playwright-report/index.html',
    'test-results/failure.png',
    'fixflags-cli/dist/index.js',
    'node_modules/pkg/index.js',
  ])
})

test('Railway configuration requires strict readiness rather than liveness', () => {
  assert.equal(railwayUsesStrictReadiness('[deploy]\nhealthcheckPath = "/api/health/ready"'), true)
  assert.equal(railwayUsesStrictReadiness('[deploy]\nhealthcheckPath = "/api/health"'), false)
})

test('critical route adapters stay thin and persistence-free', () => {
  assert.deepEqual(criticalRouteBoundaryFailures({
    'app/api/thin/route.ts': "import { service } from '@/lib/service'\nexport async function POST() { return service() }",
  }), [])
  assert.deepEqual(criticalRouteBoundaryFailures({
    'app/api/direct/route.ts': "import { prisma } from '@/lib/db'\nexport async function POST() {}",
    'app/api/large/route.ts': Array.from({ length: 161 }, () => '// line').join('\n'),
  }), [
    'app/api/direct/route.ts imports persistence directly',
    'app/api/large/route.ts exceeds 160 lines (161)',
  ])
})

test('repository completeness contracts are internally consistent', () => {
  const result = runCompletenessAudit()
  assert.deepEqual(result.failures, [])
})
