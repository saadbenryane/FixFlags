import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { REQUIRED_RELEASE_JOURNEYS } from './release-journeys.mjs'
import { assertCleanReleaseCandidate, buildReceiptContext, expectedReleaseArtifactLabels, expectedReleaseCommandLabels, hydrateReleaseFixtureEnvironment, inspectPlaywrightJourneys, RELEASE_CLI_VERSION, releaseStageCommands, requireStageJourneys, runReleaseStage, validateFinalReceiptObjects } from './release-receipts.mjs'

const SHA = 'a'.repeat(40)
function temp() { return mkdtempSync(path.join(tmpdir(), 'fixflags-release-')) }
function baseEnv(overrides = {}) {
  return {
    RELEASE_RUN_ID: 'run-1',
    RELEASE_ENV_URL: 'https://release.fixflags.test',
    RELEASE_ENV_API_KEY: 'ff_release_test',
    PRODUCTION_URL: 'https://fixflags.com',
    PRODUCTION_API_KEY: 'ff_production_test',
    ...overrides,
  }
}
function report(ids, status = 'passed') {
  return { suites: [{ specs: ids.map((id) => ({ title: `[journey:${id}] proof`, tests: [{ results: [{ status }] }] })) }] }
}
function receipt(stage, overrides = {}) {
  return {
    schemaVersion: 2,
    runId: 'run-1',
    stage,
    status: 'PASS',
    gitSha: SHA,
    targetOrigin: stage === 'foundation'
      ? null
      : stage === 'deployed'
        ? 'https://fixflags.com'
        : 'https://release.fixflags.test',
    databaseIdentityHash: ['foundation', 'fixture-binding', 'credentialed-core', 'billing-open', 'billing-closed', 'external'].includes(stage) ? 'db-hash' : null,
    apiKeyIdentityHash: null,
    containerImageDigest: stage === 'foundation' ? `sha256:${'d'.repeat(64)}` : undefined,
    releaseEnvironmentRevision: stage === 'fixture-binding' ? SHA : undefined,
    journeys: [],
    commands: expectedReleaseCommandLabels(stage).map((label) => ({ label, exitCode: 0, durationMs: 1 })),
    artifacts: expectedReleaseArtifactLabels(stage).map((label) => ({ label, sha256: 'c'.repeat(64) })),
    ...overrides,
  }
}

describe('release evidence receipts', () => {
  it('rejects dirty tracked and untracked source while ignoring owned release artifacts', () => {
    assert.throws(() => assertCleanReleaseCandidate(' M lib/audit/runner.ts\n'), /source changes/)
    assert.throws(() => assertCleanReleaseCandidate('?? scripts/new-proof.mjs\n'), /source changes/)
    assert.doesNotThrow(() => assertCleanReleaseCandidate('?? test-results/release/run-1/final.json\n'))
  })
  it('recognizes title annotations and rejects skipped proof', () => {
    assert.deepEqual(Object.keys(inspectPlaywrightJourneys(report(['anonymous-claim']))), ['anonymous-claim'])
    assert.deepEqual(Object.keys(inspectPlaywrightJourneys(report(['mcp-full-loop']))), ['mcp-full-loop'])
    assert.throws(() => requireStageJourneys('credentialed-core', report(REQUIRED_RELEASE_JOURNEYS, 'skipped')), /skipped or interrupted/)
  })

  it('rejects a missing required journey', () => {
    assert.throws(() => requireStageJourneys('credentialed-core', report(['anonymous-claim'])), /Missing required release journey/)
  })

  it('rejects duplicate journey evidence instead of collapsing it into a PASS', () => {
    const ids = [
      ...REQUIRED_RELEASE_JOURNEYS.filter((id) => !['billing-webhook-active', 'billing-revoked', 'watch-child-notification'].includes(id)),
      'anonymous-claim',
    ]
    assert.throws(
      () => requireStageJourneys('credentialed-core', report(ids)),
      /did not appear exactly once/,
    )
  })

  it('forces Git HEAD instead of RELEASE_GIT_SHA and never serializes secrets', () => {
    const workingDirectory = temp()
    const env = baseEnv({ RELEASE_GIT_SHA: 'b'.repeat(40), PRODUCTION_API_KEY: 'ff_live_secret' })
    const value = runReleaseStage('deployed', env, { workingDirectory, gitSha: SHA, repositoryStatus: '', commands: [], executor: () => ({ status: 0 }) })
    assert.equal(value.gitSha, SHA)
    assert.ok(!JSON.stringify(value).includes('ff_live_secret'))
  })

  it('records command failure as FAIL and exits no false PASS path', () => {
    const value = runReleaseStage('deployed', baseEnv(), { workingDirectory: temp(), gitSha: SHA, repositoryStatus: '', commands: [['proof', 'false', []]], executor: () => ({ status: 7 }) })
    assert.equal(value.status, 'FAIL')
  })

  it('filters each browser stage to its owned web journeys and excludes parked stages', () => {
    const core = releaseStageCommands('credentialed-core')[0][2].at(-1)
    const billing = releaseStageCommands('billing-open')[0][2].at(-1)
    assert.match(core, /anonymous-claim/)
    assert.doesNotMatch(core, /billing-webhook-active/)
    assert.match(billing, /billing-webhook-active/)
    assert.deepEqual(expectedReleaseCommandLabels('registry-cli'), [])
    assert.deepEqual(expectedReleaseArtifactLabels('registry-cli'), ['cli-registry-evidence', 'playwright-report'])
    assert.deepEqual(expectedReleaseCommandLabels('deployed'), ['deployment-attestation', 'deployed-smoke'])
  })

  it('hydrates browser inputs from a private fixture manifest without exposing its values', () => {
    const workingDirectory = temp()
    const manifestPath = path.join(workingDirectory, 'fixtures.json')
    writeFileSync(manifestPath, JSON.stringify({ fixtures: { pro: { email: 'pro@example.test', password: 'hidden', reportId: 'report', apiKey: 'ff_secret' }, free: {}, studio: {}, share: {}, watch: {}, waitlistReleased: {}, waitlistBlocked: {} } }))
    chmodSync(manifestPath, 0o600)
    const hydrated = hydrateReleaseFixtureEnvironment({ RELEASE_FIXTURE_MANIFEST: manifestPath })
    assert.equal(hydrated.E2E_PRO_EMAIL, 'pro@example.test')
    assert.equal(hydrated.RELEASE_ENV_API_KEY, 'ff_secret')
  })

  it('attests the exact release-environment revision before provisioning fixtures', () => {
    const workingDirectory = temp()
    const manifestPath = path.join(workingDirectory, 'fixtures.json')
    const commandOrder = []
    const fixtureEnv = baseEnv({
      RELEASE_E2E_TARGET: 'remote',
      RELEASE_FRESH_DATABASE_URL: 'postgresql://release:test@db.test/fixflags_release',
      RELEASE_FIXTURE_MANIFEST: manifestPath,
    })
    const databaseIdentityHash = buildReceiptContext('fixture-binding', fixtureEnv, { gitSha: SHA }).databaseIdentityHash
    const value = runReleaseStage('fixture-binding', fixtureEnv, {
      workingDirectory,
      gitSha: SHA,
      repositoryStatus: '',
      executor: (_executable, args, commandEnv) => {
        commandOrder.push(args[0])
        if (args.includes('scripts/release-revision-attestation.mjs')) {
          writeFileSync(commandEnv.RELEASE_REVISION_EVIDENCE_FILE, JSON.stringify({
            schemaVersion: 1,
            targetOrigin: 'https://release.fixflags.test',
            expectedGitSha: SHA,
            runningCommit: SHA,
          }))
        } else {
          writeFileSync(manifestPath, JSON.stringify({
            schemaVersion: 1,
            runId: 'run-1',
            gitSha: SHA,
            targetOrigin: 'https://release.fixflags.test',
            databaseIdentityHash,
            fixtures: {},
          }), { mode: 0o600 })
          chmodSync(manifestPath, 0o600)
        }
        return { status: 0 }
      },
    })
    assert.equal(value.status, 'PASS')
    assert.deepEqual(commandOrder, ['scripts/release-revision-attestation.mjs', 'tsx'])
    assert.equal(value.releaseEnvironmentRevision, SHA)
  })

  it('does not mint a customer release receipt for the parked registry CLI stage', () => {
    const workingDirectory = temp()
    const directory = path.join(workingDirectory, 'test-results', 'release', 'run-1')
    mkdirSync(directory, { recursive: true })
    const value = runReleaseStage('registry-cli', baseEnv({ E2E_AUDIT_URL: 'https://fixflags.com' }), {
      workingDirectory,
      gitSha: SHA,
      repositoryStatus: '',
      executor: (_executable, args, commandEnv) => {
        if (args.includes('scripts/verify-cli-registry.mjs')) {
          writeFileSync(commandEnv.RELEASE_CLI_REGISTRY_EVIDENCE_FILE, JSON.stringify({
            schemaVersion: 1,
            packageName: 'fixflags',
            version: RELEASE_CLI_VERSION,
            tag: 'candidate',
            installedVersion: RELEASE_CLI_VERSION,
            integrity: 'sha512-proof',
            gitSha: SHA,
          }))
        } else {
          writeFileSync(path.join(directory, 'playwright.json'), JSON.stringify(report(['cli-registry-loop'])))
        }
        return { status: 0 }
      },
    })
    assert.equal(value.status, 'BLOCKED')
    assert.match(value.reason, /Unknown release stage/)
  })

  it('injects forced HEAD and records attested deployed commit evidence', () => {
    const workingDirectory = temp()
    let observedEnv
    const value = runReleaseStage('deployed', baseEnv(), {
      workingDirectory,
      gitSha: SHA,
      repositoryStatus: '',
      executor: (_executable, args, commandEnv) => {
        observedEnv = commandEnv
        if (args.includes('scripts/release-deployment-attestation.mjs')) {
          writeFileSync(commandEnv.RELEASE_DEPLOYMENT_EVIDENCE_FILE, JSON.stringify({
            schemaVersion: 2,
            gitSha: SHA,
            ci: { status: 'SUCCESS', completedAt: '2026-08-25T20:00:00.000Z', checks: [{ name: 'verify', completedAt: '2026-08-25T20:00:00.000Z' }] },
            services: [
              { role: 'web', state: 'SUCCESS', gitSha: SHA, deploymentId: 'web-1', transitionedAt: '2026-08-25T20:01:00.000Z' },
              { role: 'worker', state: 'SUCCESS', gitSha: SHA, deploymentId: 'worker-1', transitionedAt: '2026-08-25T20:02:00.000Z' },
            ],
          }))
        } else {
          writeFileSync(commandEnv.RELEASE_SMOKE_EVIDENCE_FILE, JSON.stringify({ targetOrigin: baseEnv().PRODUCTION_URL, expectedCommit: SHA, runningCommit: SHA, routeCount: 42 }))
        }
        return { status: 0 }
      },
    })
    assert.equal(observedEnv.RELEASE_EXPECTED_GIT_SHA, SHA)
    assert.equal(value.status, 'PASS')
    assert.equal(value.deployed.runningCommit, SHA)
    assert.equal(value.deployed.routeCount, 42)
    assert.equal(value.deployed.ci.status, 'SUCCESS')
    assert.deepEqual(value.deployed.services.map((service) => service.role), ['web', 'worker'])
  })

  it('never hydrates release fixture manifests into production stages', () => {
    const workingDirectory = temp()
    let observedEnv
    const value = runReleaseStage('deployed', baseEnv({ RELEASE_FIXTURE_MANIFEST: path.join(workingDirectory, 'missing-release-fixtures.json') }), {
      workingDirectory,
      gitSha: SHA,
      repositoryStatus: '',
      executor: (_executable, args, commandEnv) => {
        observedEnv = commandEnv
        if (args.includes('scripts/release-deployment-attestation.mjs')) {
          writeFileSync(commandEnv.RELEASE_DEPLOYMENT_EVIDENCE_FILE, JSON.stringify({
            schemaVersion: 2,
            gitSha: SHA,
            ci: { status: 'SUCCESS', completedAt: '2026-08-25T20:00:00.000Z', checks: [{ name: 'verify', completedAt: '2026-08-25T20:00:00.000Z' }] },
            services: [
              { role: 'web', state: 'SUCCESS', gitSha: SHA, transitionedAt: '2026-08-25T20:01:00.000Z' },
              { role: 'worker', state: 'SUCCESS', gitSha: SHA, transitionedAt: '2026-08-25T20:02:00.000Z' },
            ],
          }))
        } else {
          writeFileSync(commandEnv.RELEASE_SMOKE_EVIDENCE_FILE, JSON.stringify({ targetOrigin: 'https://fixflags.com', expectedCommit: SHA, runningCommit: SHA, routeCount: 42 }))
        }
        return { status: 0 }
      },
    })
    assert.equal(value.status, 'PASS')
    assert.equal(observedEnv.E2E_BASE_URL, 'https://fixflags.com')
    assert.equal(observedEnv.E2E_API_KEY, undefined)
    assert.equal(observedEnv.RELEASE_FIXTURE_MANIFEST, undefined)
    assert.equal(observedEnv.RELEASE_ENV_API_KEY, undefined)
  })

  it('records missing proof as BLOCKED', () => {
    const workingDirectory = temp()
    const directory = path.join(workingDirectory, 'test-results', 'release', 'run-1')
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(directory, 'playwright.json'), JSON.stringify(report(['anonymous-claim'])))
    const value = runReleaseStage('credentialed-core', baseEnv(Object.fromEntries([
      'E2E_AUDIT_URL','E2E_SIGNUP_PASSWORD','E2E_2FA_EMAIL','E2E_2FA_PASSWORD','E2E_2FA_BACKUP_CODE','E2E_WEBAUTHN_CREDENTIAL_ID','E2E_WEBAUTHN_PRIVATE_KEY','E2E_WEBAUTHN_USER_HANDLE','E2E_BILLING_FREE_EMAIL','E2E_BILLING_FREE_PASSWORD','E2E_BILLING_PAID_EMAIL','E2E_BILLING_PAID_PASSWORD','E2E_SHARE_OWNER_EMAIL','E2E_SHARE_OWNER_PASSWORD','E2E_SHARE_REPORT_ID','E2E_SHARE_PASSWORD','E2E_API_KEY',
    ].map((name) => [name, 'fixture']))), { workingDirectory, gitSha: SHA, repositoryStatus: '', commands: [] })
    assert.equal(value.status, 'BLOCKED')
  })

  it('rejects mixed runs, stale revisions, and incomplete canonical journeys', () => {
    const stages = ['foundation','fixture-binding','credentialed-core','billing-open','billing-closed','external','deployed']
    const receipts = stages.map((stage) => receipt(stage))
    assert.throws(() => validateFinalReceiptObjects(receipts, SHA), /Missing PASS evidence/)
    const all = receipts.map((value) => ({ ...value, journeys: (value.stage === 'credentialed-core'
      ? REQUIRED_RELEASE_JOURNEYS.filter((id) => !['billing-webhook-active','billing-revoked','watch-child-notification'].includes(id))
      : value.stage === 'billing-open' ? ['billing-webhook-active']
      : value.stage === 'billing-closed' ? ['billing-revoked']
      : value.stage === 'external' ? ['watch-child-notification'] : []).map((id) => ({ id, status: 'PASS' })) }))
    const separated = all.map((value) =>
      value.stage === 'deployed'
        ? { ...value, targetOrigin: 'https://fixflags.com' }
        : value,
    )
    assert.doesNotThrow(() => validateFinalReceiptObjects(separated, SHA))
    assert.throws(
      () => validateFinalReceiptObjects([...separated, { ...receipt('deployed'), targetOrigin: 'https://wrong-production.example' }], SHA),
      /duplicate stages/,
    )
    assert.throws(() => validateFinalReceiptObjects(all.map((value, index) => index === 1 ? { ...value, runId: 'other' } : value), SHA), /mixed run IDs/)
    assert.throws(() => validateFinalReceiptObjects(all, 'b'.repeat(40)), /current Git HEAD/)
    assert.throws(
      () => validateFinalReceiptObjects([...separated, receipt('registry-cli')], SHA),
      /Unknown release receipt stage: registry-cli/,
    )
  })

  it('rejects manually minted command evidence and exposes no record-PASS command', () => {
    const stages = ['foundation','fixture-binding','credentialed-core','billing-open','billing-closed','external','deployed']
    const forged = stages.map((stage) => receipt(stage))
    forged[0] = { ...forged[0], commands: [] }
    assert.throws(() => validateFinalReceiptObjects(forged, SHA), /command evidence is incomplete/)
    const cli = spawnSync(process.execPath, ['scripts/release-receipts.mjs', 'record', 'foundation'], { encoding: 'utf8' })
    assert.notEqual(cli.status, 0)
    assert.match(cli.stderr, /Use release-receipts\.mjs stage/)
  })

  it('writes schema-v2 receipts without environment contents', () => {
    const workingDirectory = temp()
    runReleaseStage('deployed', baseEnv({ SOME_SECRET: 'never-write-me' }), { workingDirectory, gitSha: SHA, repositoryStatus: '', commands: [] })
    const serialized = readFileSync(path.join(workingDirectory, 'test-results/release/run-1/deployed.json'), 'utf8')
    assert.match(serialized, /"schemaVersion": 2/)
    assert.ok(!serialized.includes('never-write-me'))
  })
})
