import test from 'node:test'
import assert from 'node:assert/strict'
import railwayRuntime from '../.railway/railway.ts'
import {
  collectMcpToolManifest,
  collectMcpTools,
  collectRegisteredMcpToolKeys,
  collectTrackedGeneratedArtifacts,
  criticalRouteBoundaryFailures,
  curatedSampleBundleFailures,
  savedEvidenceCompositionIsCanonical,
  railwayUsesStrictReadiness,
  productionDevelopmentImporters,
  runCompletenessAudit,
} from './completeness-audit.mjs'

test('collectMcpTools extracts registered names without prose references', () => {
  assert.deepEqual(collectMcpTools("server.tool(\n 'ff_one', x)\n// ff_fake\nserver.tool('generate-two', y)"), ['ff_one', 'generate-two'])
})

test('saved evidence guard rejects retired workspaces and malformed JSX', () => {
  const source = 'export function View() { return <AuditShell><main><h2>Saved observations</h2><a>Analyze a website</a></main></AuditShell> }'
  assert.equal(savedEvidenceCompositionIsCanonical(source), true)
  assert.equal(savedEvidenceCompositionIsCanonical(source.replace('<main>', '<main><WorkspaceChatPanel />')), false)
  assert.equal(savedEvidenceCompositionIsCanonical(source.replace('Saved observations', 'Score')), false)
  assert.equal(savedEvidenceCompositionIsCanonical(source.slice(0, -20)), false)
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
    'app/(marketing)/coverage/page.tsx',
    'app/api/sites/[siteId]/coverage/route.ts',
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
  const configuration = railwayRuntime({ environment: 'production' })
  assert.equal(railwayUsesStrictReadiness(configuration), true)
  for (const name of ['FixFlags', 'FixFlags Worker']) {
    const livenessOnly = {
      ...configuration,
      resources: configuration.resources.map(resource => resource.name === name
        ? { ...resource, deploy: { ...resource.deploy, healthcheckPath: '/api/health' } }
        : resource),
    }
    assert.equal(railwayUsesStrictReadiness(livenessOnly), false)
  }
  assert.equal(railwayUsesStrictReadiness({ resources: configuration.resources.slice(0, 1) }), false)
})

test('runtime migration preserves secrets, source policy and explicit worker admission', () => {
  const configuration = railwayRuntime({ environment: 'production' })
  assert.deepEqual(configuration.resources.map(resource => resource.name), ['FixFlags', 'FixFlags Worker'])
  for (const resource of configuration.resources) {
    assert.deepEqual(resource.build, { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' })
    assert.equal(resource.deploy.healthcheckTimeout, 300)
    assert.equal(resource.deploy.restartPolicyType, undefined, 'Use the canonical omitted ON_FAILURE default')
    assert.equal(resource.deploy.restartPolicyMaxRetries, 3)
    assert.equal(resource.source.checkSuites, false)
    for (const name of ['DATABASE_URL', 'REDIS_URL', 'BETTER_AUTH_SECRET', 'TOKEN_ENCRYPTION_KEY', 'ACCOUNT_CHECKS_ENABLED', 'RESEND_API_KEY']) {
      assert.equal(resource.variables[name]?.type, 'preserve', `${resource.name}.${name}`)
    }
    assert.ok(Object.values(resource.variables).every(value => value.type === 'preserve'))
  }
  assert.equal(configuration.resources[1].deploy.startCommand, 'node scripts/runtime-start.mjs worker')
  assert.throws(() => railwayRuntime({ environment: 'public-validation' }), /production only/)
})

test('production import boundary excludes tests while rejecting actual development imports', () => {
  assert.deepEqual(productionDevelopmentImporters({
    'lib/release/fixture-authentication.test.ts': "import { fixture } from '../../scripts/fixture.mjs'",
    'lib/__tests__/fixture.ts': "import { fixture } from '../../e2e/fixture'",
    'lib/ordinary.ts': "// import { example } from '@/scripts/example'\nimport { utility } from './utility'",
    'app/api/example/route.ts': "import { fixture } from '@/scripts/fixture.mjs'",
    'lib/source.ts': "export { fixture } from '../e2e/fixture'",
    'worker/job.ts': "const fixture = require('../lib/release/example.test')",
    'components/example.tsx': "const fixture = import('../lib/__tests__/fixture')",
  }), ['app/api/example/route.ts', 'lib/source.ts', 'worker/job.ts', 'components/example.tsx'])
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
