#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_RELEASE_JOURNEYS, JOURNEYS_BY_STAGE } from './release-journeys.mjs'
import { canonicalDatabaseIdentity, RELEASE_STAGES, validateReleasePreflight } from './release-preflight.mjs'

export const REQUIRED_RECEIPT_STAGES = [...RELEASE_STAGES]
export const RELEASE_ENV_STAGES = new Set([
  'fixture-binding',
  'credentialed-core',
  'billing-open',
  'billing-closed',
  'external',
])
export const PRODUCTION_STAGES = new Set(['deployed', 'registry-cli', 'production-dogfood'])
export const RELEASE_CLI_VERSION = '1.0.5'
const TERMINAL_STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted'])
const RELEASE_FIXTURE_ENV_KEYS = new Set([
  'RELEASE_FIXTURE_MANIFEST',
  'RELEASE_ENV_URL',
  'RELEASE_ENV_API_KEY',
  'RELEASE_FRESH_DATABASE_URL',
  'E2E_BILLING_FREE_EMAIL',
  'E2E_BILLING_FREE_PASSWORD',
  'E2E_FREE_REPORT_ID',
  'E2E_BILLING_PAID_EMAIL',
  'E2E_BILLING_PAID_PASSWORD',
  'E2E_PRO_EMAIL',
  'E2E_PRO_PASSWORD',
  'E2E_PRO_REPORT_ID',
  'E2E_STUDIO_EMAIL',
  'E2E_STUDIO_PASSWORD',
  'E2E_SHARE_OWNER_EMAIL',
  'E2E_SHARE_OWNER_PASSWORD',
  'E2E_SHARE_REPORT_ID',
  'E2E_WATCH_EMAIL',
  'E2E_WATCH_PASSWORD',
  'E2E_WATCH_PROJECT_ID',
  'E2E_GATE_MEMBER_RELEASED_ENTRY_ID',
  'E2E_GATE_MEMBER_BLOCKED_ENTRY_ID',
])

function safeRunId(value) {
  if (!value || !/^[a-zA-Z0-9._-]+$/.test(value)) {
    throw new Error('RELEASE_RUN_ID is required and may contain only letters, numbers, dot, underscore, or dash')
  }
  return value
}

export function currentGitSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

export function assertCleanReleaseCandidate(statusText) {
  const dirty = statusText
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .filter((line) => {
      const file = line.slice(3).replace(/^"|"$/g, '')
      return !file.startsWith('test-results/release/')
    })
  if (dirty.length > 0) {
    throw new Error('Release candidate contains tracked or untracked source changes')
  }
}

function cleanOrigin(value) {
  if (!value) return null
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('release target must use https')
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('release target must be a clean origin')
  }
  return url.origin
}

export function receiptDirectory(env = process.env, workingDirectory = process.cwd()) {
  return path.join(workingDirectory, 'test-results', 'release', safeRunId(env.RELEASE_RUN_ID))
}

function playwrightReportPath(env, workingDirectory) {
  return path.join(receiptDirectory(env, workingDirectory), 'playwright.json')
}

export function hydrateReleaseFixtureEnvironment(env) {
  if (!env.RELEASE_FIXTURE_MANIFEST) return env
  const manifestPath = path.resolve(env.RELEASE_FIXTURE_MANIFEST)
  const stat = statSync(manifestPath)
  if (!stat.isFile() || lstatSync(manifestPath).isSymbolicLink() || (stat.mode & 0o077) !== 0) {
    throw new Error('Fixture manifest must be a regular mode-600 file')
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const fixtures = manifest.fixtures ?? {}
  const mapped = {
    E2E_BILLING_FREE_EMAIL: fixtures.free?.email,
    E2E_BILLING_FREE_PASSWORD: fixtures.free?.password,
    E2E_FREE_REPORT_ID: fixtures.free?.reportId,
    E2E_BILLING_PAID_EMAIL: fixtures.pro?.email,
    E2E_BILLING_PAID_PASSWORD: fixtures.pro?.password,
    E2E_PRO_EMAIL: fixtures.pro?.email,
    E2E_PRO_PASSWORD: fixtures.pro?.password,
    E2E_PRO_REPORT_ID: fixtures.pro?.reportId,
    RELEASE_ENV_API_KEY: fixtures.pro?.apiKey,
    E2E_STUDIO_EMAIL: fixtures.studio?.email,
    E2E_STUDIO_PASSWORD: fixtures.studio?.password,
    E2E_SHARE_OWNER_EMAIL: fixtures.share?.email,
    E2E_SHARE_OWNER_PASSWORD: fixtures.share?.password,
    E2E_SHARE_REPORT_ID: fixtures.share?.reportId,
    E2E_WATCH_EMAIL: fixtures.watch?.email,
    E2E_WATCH_PASSWORD: fixtures.watch?.password,
    E2E_WATCH_PROJECT_ID: fixtures.watch?.projectId,
    E2E_GATE_MEMBER_RELEASED_ENTRY_ID: fixtures.waitlistReleased?.entryId,
    E2E_GATE_MEMBER_BLOCKED_ENTRY_ID: fixtures.waitlistBlocked?.entryId,
  }
  return { ...env, ...Object.fromEntries(Object.entries(mapped).filter(([, value]) => typeof value === 'string' && value)) }
}

export function inspectPlaywrightJourneys(report) {
  const found = new Map()
  const unknown = new Set()
  const visit = (value, inheritedIds = []) => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child, inheritedIds)
      return
    }
    if (!value || typeof value !== 'object') return
    const ownIds = typeof value.title === 'string'
      ? [...value.title.matchAll(/\[journey:([a-z0-9-]+)\]/g)].map((match) => match[1])
      : []
    for (const id of ownIds) if (!REQUIRED_RELEASE_JOURNEYS.includes(id)) unknown.add(id)
    const ids = [...new Set([...inheritedIds, ...ownIds])]
    if (typeof value.status === 'string' && TERMINAL_STATUSES.has(value.status)) {
      for (const id of ids) {
        const statuses = found.get(id) ?? []
        statuses.push(value.status)
        found.set(id, statuses)
      }
    }
    for (const child of Object.values(value)) visit(child, ids)
  }
  visit(report)
  if (unknown.size) throw new Error(`Playwright report contains unknown journey IDs: ${[...unknown].join(', ')}`)
  return Object.fromEntries([...found].map(([id, statuses]) => [id, statuses]))
}

export function requireStageJourneys(stage, report) {
  const required = JOURNEYS_BY_STAGE[stage] ?? []
  const found = inspectPlaywrightJourneys(report)
  return required.map((id) => {
    const statuses = found[id] ?? []
    if (!statuses.length) throw new Error(`Missing required release journey: ${id}`)
    if (statuses.length !== 1) throw new Error(`Release journey ${id} did not appear exactly once`)
    if (statuses.some((status) => status === 'skipped' || status === 'interrupted')) {
      throw new Error(`Release journey ${id} was skipped or interrupted`)
    }
    if (statuses.some((status) => status !== 'passed')) {
      throw new Error(`Release journey ${id} did not pass`)
    }
    return { id, status: 'PASS' }
  })
}

export function releaseStageCommands(stage) {
  if (stage === 'foundation') {
    return [
      ['clean-install', 'npm', ['ci']],
      ['clean-install-cli', 'npm', ['ci', '--prefix', 'fixflags-cli']],
      ['fresh-database', 'node', ['scripts/release-database.mjs']],
      ['full-verification', 'npm', ['run', 'verify']],
      ['container-build', 'docker', ['build', '-t', 'fixflags:release-check', '.']],
      ['container-ready', 'node', ['scripts/container-smoke.mjs']],
    ]
  }
  if (stage === 'fixture-binding') {
    return [
      ['release-env-revision', 'node', ['scripts/release-revision-attestation.mjs']],
      ['provision-fixtures', 'npx', ['tsx', 'scripts/provision-release-fixtures.ts']],
    ]
  }
  if (JOURNEYS_BY_STAGE[stage]) {
    const grep = (JOURNEYS_BY_STAGE[stage] ?? []).map((id) => `\\[journey:${id}\\]`).join('|')
    const journeyCommand = ['credentialed-journeys', 'npm', ['run', 'test:e2e:release', '--', '--grep', grep]]
    if (stage === 'registry-cli') return [
      ['registry-package', 'node', [
        'scripts/verify-cli-registry.mjs',
        '--version',
        RELEASE_CLI_VERSION,
        '--tag',
        'candidate',
        '--clean-install',
      ]],
      journeyCommand,
    ]
    return [journeyCommand]
  }
  if (stage === 'deployed') return [
    ['deployment-attestation', 'node', ['scripts/release-deployment-attestation.mjs']],
    ['deployed-smoke', 'npm', ['run', 'smoke:release']],
  ]
  if (stage === 'production-dogfood') return [
    ['production-smoke', 'npm', ['run', 'smoke:release']],
    ['production-fix-verify-watch', 'node', ['scripts/verify-production-dogfood.mjs']],
  ]
  return []
}

export function expectedReleaseCommandLabels(stage) {
  return releaseStageCommands(stage).map(([label]) => label)
}

function safeReason(error) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/(?:postgres(?:ql)?:\/\/|sk_(?:test|live)_|ff_[a-z]+_)[^\s]+/gi, '[REDACTED]')
}

function fileHash(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

export function expectedReleaseArtifactLabels(stage) {
  if (stage === 'fixture-binding') return ['release-env-revision', 'fixture-manifest']
  if (stage === 'registry-cli') return ['cli-registry-evidence', 'playwright-report']
  if (JOURNEYS_BY_STAGE[stage]) return ['playwright-report']
  if (stage === 'deployed') return ['deployment-attestation', 'smoke-evidence']
  if (stage === 'production-dogfood') return ['dogfood-evidence', 'smoke-evidence']
  return []
}

function writeReceipt(receipt, env, workingDirectory) {
  const directory = receiptDirectory(env, workingDirectory)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const target = path.join(directory, `${receipt.stage}.json`)
  writeFileSync(target, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  return receipt
}

function validateFixtureManifest(env, context) {
  if (!env.RELEASE_FIXTURE_MANIFEST) throw new Error('Fixture provisioning did not bind RELEASE_FIXTURE_MANIFEST')
  const manifestPath = path.resolve(env.RELEASE_FIXTURE_MANIFEST)
  if (lstatSync(manifestPath).isSymbolicLink()) throw new Error('Fixture manifest must not be a symbolic link')
  const stat = statSync(manifestPath)
  if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error('Fixture manifest must be a regular mode-600 file')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1) throw new Error('Fixture manifest schema is unsupported')
  if (manifest.runId !== safeRunId(env.RELEASE_RUN_ID)) throw new Error('Fixture manifest run ID mismatch')
  if (manifest.gitSha !== context.gitSha) throw new Error('Fixture manifest Git revision mismatch')
  if (manifest.targetOrigin !== context.targetOrigin) throw new Error('Fixture manifest target origin mismatch')
  if (manifest.databaseIdentityHash !== context.databaseIdentityHash) throw new Error('Fixture manifest database identity mismatch')
  if (!manifest.fixtures || typeof manifest.fixtures !== 'object') throw new Error('Fixture manifest has no fixtures')
}

export function buildReceiptContext(stage, env, options = {}) {
  if (!REQUIRED_RECEIPT_STAGES.includes(stage)) throw new Error(`Unknown release stage: ${stage}`)
  const gitSha = options.gitSha ?? currentGitSha()
  const targetOrigin = stage === 'foundation'
    ? null
    : cleanOrigin(PRODUCTION_STAGES.has(stage) ? env.PRODUCTION_URL : env.RELEASE_ENV_URL)
  const databaseIdentityHash = (stage === 'foundation' || RELEASE_ENV_STAGES.has(stage)) && env.RELEASE_FRESH_DATABASE_URL
    ? createHash('sha256').update(canonicalDatabaseIdentity(env.RELEASE_FRESH_DATABASE_URL)).digest('hex')
    : null
  const apiKey = PRODUCTION_STAGES.has(stage)
    ? env.PRODUCTION_API_KEY
    : RELEASE_ENV_STAGES.has(stage) && stage !== 'fixture-binding'
      ? env.RELEASE_ENV_API_KEY
      : null
  const apiKeyIdentityHash = apiKey
    ? createHash('sha256').update(apiKey).digest('hex')
    : null
  return { gitSha, targetOrigin, databaseIdentityHash, apiKeyIdentityHash }
}

export function runReleaseStage(stage, env = process.env, options = {}) {
  const workingDirectory = options.workingDirectory ?? process.cwd()
  try {
    if (RELEASE_ENV_STAGES.has(stage) && stage !== 'fixture-binding') {
      env = hydrateReleaseFixtureEnvironment(env)
    }
  }
  catch (error) {
    const runId = safeRunId(env.RELEASE_RUN_ID)
    const now = (options.now?.() ?? new Date()).toISOString()
    return writeReceipt({ schemaVersion: 2, runId, stage, status: 'BLOCKED', gitSha: options.gitSha ?? currentGitSha(), targetOrigin: null, databaseIdentityHash: null, startedAt: now, completedAt: now, commands: [], journeys: [], reason: safeReason(error) }, env, workingDirectory)
  }
  const runId = safeRunId(env.RELEASE_RUN_ID)
  mkdirSync(receiptDirectory(env, workingDirectory), { recursive: true, mode: 0o700 })
  const startedAt = (options.now?.() ?? new Date()).toISOString()
  const commands = []
  let context = { gitSha: options.gitSha ?? currentGitSha(), targetOrigin: null, databaseIdentityHash: null }
  let status = 'PASS'
  let reason = null
  let journeys = []
  let artifacts = []
  try {
    const repositoryStatus = options.repositoryStatus ?? execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=all'],
      { cwd: workingDirectory, encoding: 'utf8' },
    )
    assertCleanReleaseCandidate(repositoryStatus)
    const issues = validateReleasePreflight(env, { stage, checkFile: options.checkFile !== false })
    if (issues.length) throw new Error(`Preflight blocked: ${issues.join('; ')}`)
    context = buildReceiptContext(stage, env, options)
    const evidenceFile = path.join(receiptDirectory(env, workingDirectory), `${stage}-smoke.json`)
    const deploymentEvidenceFile = path.join(
      receiptDirectory(env, workingDirectory),
      `${stage}-deployment.json`,
    )
    const dogfoodEvidenceFile = path.join(
      receiptDirectory(env, workingDirectory),
      `${stage}-evidence.json`,
    )
    const revisionEvidenceFile = path.join(
      receiptDirectory(env, workingDirectory),
      `${stage}-revision.json`,
    )
    const cliRegistryEvidenceFile = path.join(
      receiptDirectory(env, workingDirectory),
      `${stage}-registry.json`,
    )
    const targetEnv = RELEASE_ENV_STAGES.has(stage)
      ? {
          E2E_BASE_URL: env.RELEASE_ENV_URL,
          E2E_API_KEY: env.RELEASE_ENV_API_KEY,
        }
      : PRODUCTION_STAGES.has(stage)
        ? {
            E2E_BASE_URL: env.PRODUCTION_URL,
            E2E_API_KEY: env.PRODUCTION_API_KEY,
          }
        : {}
    const commandBaseEnv = PRODUCTION_STAGES.has(stage)
      ? Object.fromEntries(Object.entries(env).filter(([name]) => !RELEASE_FIXTURE_ENV_KEYS.has(name)))
      : env
    const stageEnv = {
      ...commandBaseEnv,
      ...targetEnv,
      RELEASE_JOURNEY_STAGE: stage,
      RELEASE_EXPECTED_GIT_SHA: context.gitSha,
      RELEASE_SMOKE_EVIDENCE_FILE: evidenceFile,
      RELEASE_DEPLOYMENT_EVIDENCE_FILE: deploymentEvidenceFile,
      RELEASE_DOGFOOD_EVIDENCE_FILE: dogfoodEvidenceFile,
      RELEASE_REVISION_EVIDENCE_FILE: revisionEvidenceFile,
      RELEASE_CLI_REGISTRY_EVIDENCE_FILE: cliRegistryEvidenceFile,
    }
    const executor = options.executor ?? ((executable, args, commandEnv) => spawnSync(executable, args, { cwd: workingDirectory, env: commandEnv, stdio: 'inherit' }))
    for (const [label, executable, args] of (options.commands ?? releaseStageCommands(stage))) {
      const before = Date.now()
      const result = executor(executable, args, stageEnv)
      const exitCode = typeof result?.status === 'number' ? result.status : 1
      commands.push({ label, exitCode, durationMs: Math.max(0, Date.now() - before) })
      if (exitCode !== 0) throw new Error(`${label} failed with exit code ${exitCode}`)
    }
    if (JOURNEYS_BY_STAGE[stage]) {
      const report = JSON.parse(readFileSync(playwrightReportPath(env, workingDirectory), 'utf8'))
      journeys = requireStageJourneys(stage, report)
    }
    if (stage === 'production-dogfood') {
      const dogfood = JSON.parse(readFileSync(dogfoodEvidenceFile, 'utf8'))
      if (dogfood.schemaVersion !== 1 || dogfood.targetOrigin !== context.targetOrigin) {
        throw new Error('Production dogfood evidence target mismatch')
      }
      if (dogfood.improved?.outcome !== 'IMPROVED' || dogfood.inconclusive?.outcome !== 'INCONCLUSIVE') {
        throw new Error('Production dogfood outcomes are incomplete')
      }
      context.dogfood = {
        loop: 'Product Review → Fix → Verify → Learn',
        status: 'PASS',
        improved: dogfood.improved,
        inconclusive: dogfood.inconclusive,
        memory: dogfood.memory,
      }
      const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8'))
      if (evidence.targetOrigin !== context.targetOrigin || evidence.runningCommit !== context.gitSha) {
        throw new Error('Production dogfood revision or target mismatch')
      }
      context.dogfood.runningCommit = evidence.runningCommit
    }
    if (RELEASE_ENV_STAGES.has(stage) && env.RELEASE_FIXTURE_MANIFEST) {
      validateFixtureManifest(env, context)
    }
    if (stage === 'fixture-binding') {
      const revision = JSON.parse(readFileSync(revisionEvidenceFile, 'utf8'))
      if (
        revision.schemaVersion !== 1 ||
        revision.targetOrigin !== context.targetOrigin ||
        revision.expectedGitSha !== context.gitSha ||
        revision.runningCommit !== context.gitSha
      ) {
        throw new Error('Release environment revision attestation mismatch')
      }
      context.releaseEnvironmentRevision = revision.runningCommit
    }
    if (stage === 'foundation') {
      context.containerImageDigest = options.containerImageDigest ?? execFileSync(
        'docker',
        ['image', 'inspect', 'fixflags:release-check', '--format', '{{.Id}}'],
        { encoding: 'utf8' },
      ).trim()
      if (!context.containerImageDigest.startsWith('sha256:')) {
        throw new Error('Foundation container image digest is invalid')
      }
    }
    if (stage === 'deployed') {
      const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8'))
      if (evidence.targetOrigin !== context.targetOrigin) throw new Error('Deployed smoke target mismatch')
      if (evidence.expectedCommit !== context.gitSha || evidence.runningCommit !== context.gitSha) {
        throw new Error('Deployed smoke revision mismatch')
      }
      const deployment = JSON.parse(readFileSync(deploymentEvidenceFile, 'utf8'))
      if (deployment.schemaVersion !== 2 || deployment.gitSha !== context.gitSha) {
        throw new Error('Deployment attestation revision mismatch')
      }
      if (deployment.ci?.status !== 'SUCCESS') throw new Error('Candidate CI was not successful')
      const roles = new Map((deployment.services ?? []).map((service) => [service.role, service]))
      for (const role of ['web', 'worker']) {
        const service = roles.get(role)
        if (
          !service ||
          service.state !== 'SUCCESS' ||
          service.gitSha !== context.gitSha ||
          !service.transitionedAt ||
          Date.parse(service.transitionedAt) <= Date.parse(deployment.ci.completedAt)
        ) {
          throw new Error(`${role} deployment attestation is missing or invalid`)
        }
      }
      context.deployed = {
        runningCommit: evidence.runningCommit,
        routeCount: evidence.routeCount,
        ci: deployment.ci,
        services: deployment.services,
      }
    }
    if (stage === 'registry-cli') {
      const registry = JSON.parse(readFileSync(cliRegistryEvidenceFile, 'utf8'))
      if (
        registry.schemaVersion !== 1 ||
        registry.packageName !== 'fixflags' ||
        registry.version !== RELEASE_CLI_VERSION ||
        registry.tag !== 'candidate' ||
        registry.installedVersion !== RELEASE_CLI_VERSION ||
        registry.gitSha !== context.gitSha
      ) {
        throw new Error('Candidate CLI registry evidence is incomplete')
      }
      context.cli = {
        packageName: registry.packageName,
        version: registry.version,
        tag: registry.tag,
        installedVersion: registry.installedVersion,
        integrity: registry.integrity,
        gitSha: registry.gitSha,
      }
    }
    const artifactFiles = []
    if (stage === 'fixture-binding') {
      artifactFiles.push(['release-env-revision', revisionEvidenceFile])
      artifactFiles.push(['fixture-manifest', path.resolve(env.RELEASE_FIXTURE_MANIFEST)])
    }
    if (JOURNEYS_BY_STAGE[stage]) {
      artifactFiles.push(['playwright-report', playwrightReportPath(env, workingDirectory)])
    }
    if (stage === 'registry-cli') {
      artifactFiles.push(['cli-registry-evidence', cliRegistryEvidenceFile])
    }
    if (['deployed', 'production-dogfood'].includes(stage)) {
      artifactFiles.push(['smoke-evidence', evidenceFile])
    }
    if (stage === 'deployed') {
      artifactFiles.push(['deployment-attestation', deploymentEvidenceFile])
    }
    if (stage === 'production-dogfood') {
      artifactFiles.push(['dogfood-evidence', dogfoodEvidenceFile])
    }
    artifacts = artifactFiles.map(([label, file]) => ({ label, sha256: fileHash(file) }))
  } catch (error) {
    status = commands.length > 0 ? 'FAIL' : 'BLOCKED'
    reason = safeReason(error)
  }
  const receipt = {
    schemaVersion: 2,
    runId,
    stage,
    status,
    ...context,
    startedAt,
    completedAt: (options.now?.() ?? new Date()).toISOString(),
    commands,
    journeys,
    artifacts,
    ...(reason ? { reason } : {}),
  }
  writeReceipt(receipt, env, workingDirectory)
  return receipt
}

export function validateFinalReceiptObjects(receipts, expectedGitSha) {
  const byStage = new Map(receipts.map((receipt) => [receipt.stage, receipt]))
  for (const stage of REQUIRED_RECEIPT_STAGES) {
    const receipt = byStage.get(stage)
    if (!receipt) throw new Error(`Missing valid ${stage} release receipt`)
    if (receipt.schemaVersion !== 2) throw new Error(`${stage} release receipt is not schema v2`)
    if (receipt.status !== 'PASS') throw new Error(`${stage} release receipt is not PASS`)
    const expectedLabels = expectedReleaseCommandLabels(stage)
    const actualLabels = (receipt.commands ?? []).map((item) => item.label)
    if (JSON.stringify(actualLabels) !== JSON.stringify(expectedLabels)) {
      throw new Error(`${stage} release receipt command evidence is incomplete`)
    }
    if ((receipt.commands ?? []).some((item) => item.exitCode !== 0)) {
      throw new Error(`${stage} release receipt contains failed command evidence`)
    }
    const expectedArtifacts = expectedReleaseArtifactLabels(stage)
    const actualArtifacts = (receipt.artifacts ?? []).map((item) => item.label).sort()
    if (JSON.stringify(actualArtifacts) !== JSON.stringify([...expectedArtifacts].sort())) {
      throw new Error(`${stage} release receipt artifact evidence is incomplete`)
    }
    if ((receipt.artifacts ?? []).some((item) => !/^[a-f0-9]{64}$/.test(item.sha256))) {
      throw new Error(`${stage} release receipt contains an invalid artifact hash`)
    }
    if (
      (['credentialed-core', 'billing-open', 'billing-closed', 'external', 'registry-cli', 'production-dogfood'].includes(stage)) &&
      !/^[a-f0-9]{64}$/.test(receipt.apiKeyIdentityHash ?? '')
    ) {
      throw new Error(`${stage} release receipt has no valid API key identity`)
    }
    if (stage === 'foundation' && !/^sha256:[a-f0-9]{64}$/.test(receipt.containerImageDigest ?? '')) {
      throw new Error('foundation release receipt has no valid container image digest')
    }
    if (stage === 'fixture-binding' && receipt.releaseEnvironmentRevision !== receipt.gitSha) {
      throw new Error('fixture-binding release receipt has no exact revision attestation')
    }
    if (
      stage === 'registry-cli' &&
      (
        receipt.cli?.packageName !== 'fixflags' ||
        receipt.cli?.version !== RELEASE_CLI_VERSION ||
        receipt.cli?.tag !== 'candidate' ||
        receipt.cli?.installedVersion !== RELEASE_CLI_VERSION ||
        receipt.cli?.gitSha !== receipt.gitSha
      )
    ) {
      throw new Error('registry-cli release receipt has no exact candidate proof')
    }
    const allowedJourneys = new Set(JOURNEYS_BY_STAGE[stage] ?? [])
    if ((receipt.journeys ?? []).some((journey) => !allowedJourneys.has(journey.id))) {
      throw new Error(`${stage} release receipt contains journey evidence owned by another stage`)
    }
  }
  const runIds = new Set(receipts.map((receipt) => receipt.runId))
  if (runIds.size !== 1) throw new Error('Release receipts have mixed run IDs')
  const revisions = new Set(receipts.map((receipt) => receipt.gitSha))
  if (revisions.size !== 1 || !revisions.has(expectedGitSha)) {
    throw new Error('Release receipts do not match the current Git HEAD')
  }
  const releaseOrigins = new Set(receipts
    .filter((receipt) => RELEASE_ENV_STAGES.has(receipt.stage))
    .map((receipt) => receipt.targetOrigin)
    .filter(Boolean))
  if (releaseOrigins.size !== 1) throw new Error('Release-environment receipts have mixed target origins')
  const productionOrigins = new Set(receipts
    .filter((receipt) => PRODUCTION_STAGES.has(receipt.stage))
    .map((receipt) => receipt.targetOrigin)
    .filter(Boolean))
  if (productionOrigins.size !== 1) throw new Error('Production receipts have mixed target origins')
  if ([...releaseOrigins][0] === [...productionOrigins][0]) {
    throw new Error('Release environment and production receipts target the same origin')
  }
  const databaseIdentities = new Set(receipts.map((receipt) => receipt.databaseIdentityHash).filter(Boolean))
  if (databaseIdentities.size !== 1) throw new Error('Release receipts have mixed database identities')
  const releaseApiKeyIdentities = new Set(receipts
    .filter((receipt) => RELEASE_ENV_STAGES.has(receipt.stage) && receipt.stage !== 'fixture-binding')
    .map((receipt) => receipt.apiKeyIdentityHash)
    .filter(Boolean))
  if (releaseApiKeyIdentities.size !== 1) throw new Error('Release-environment receipts have mixed API key identities')
  const productionApiKeyIdentities = new Set(receipts
    .filter((receipt) => PRODUCTION_STAGES.has(receipt.stage) && receipt.stage !== 'deployed')
    .map((receipt) => receipt.apiKeyIdentityHash)
    .filter(Boolean))
  if (productionApiKeyIdentities.size !== 1) throw new Error('Production receipts have mixed API key identities')
  if ([...releaseApiKeyIdentities][0] === [...productionApiKeyIdentities][0]) {
    throw new Error('Release environment and production receipts use the same API key identity')
  }
  const journeys = new Map(receipts.flatMap((receipt) => receipt.journeys ?? []).map((journey) => [journey.id, journey.status]))
  for (const id of REQUIRED_RELEASE_JOURNEYS) {
    if (journeys.get(id) !== 'PASS') throw new Error(`Missing PASS evidence for release journey: ${id}`)
  }
  return {
    runId: receipts[0].runId,
    gitSha: expectedGitSha,
    releaseOrigin: [...releaseOrigins][0],
    productionOrigin: [...productionOrigins][0],
  }
}

export function validateFinalReceipts(env = process.env, options = {}) {
  const workingDirectory = options.workingDirectory ?? process.cwd()
  assertCleanReleaseCandidate(options.repositoryStatus ?? execFileSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: workingDirectory, encoding: 'utf8' },
  ))
  const directory = receiptDirectory(env, workingDirectory)
  const receipts = REQUIRED_RECEIPT_STAGES.map((stage) => {
    try { return JSON.parse(readFileSync(path.join(directory, `${stage}.json`), 'utf8')) }
    catch { throw new Error(`Missing valid ${stage} release receipt`) }
  })
  const result = validateFinalReceiptObjects(receipts, options.gitSha ?? currentGitSha())
  const now = new Date().toISOString()
  writeReceipt({
    schemaVersion: 2,
    runId: result.runId,
    stage: 'final',
    status: 'PASS',
    gitSha: result.gitSha,
    targetOrigin: result.productionOrigin,
    databaseIdentityHash: receipts.find((receipt) => receipt.databaseIdentityHash)?.databaseIdentityHash ?? null,
    startedAt: now,
    completedAt: now,
    commands: [{ label: 'aggregate-stage-receipts', exitCode: 0, durationMs: 0 }],
    journeys: REQUIRED_RELEASE_JOURNEYS.map((id) => ({ id, status: 'PASS' })),
    artifacts: [],
  }, env, workingDirectory)
  return result
}

function main() {
  const [action, stage] = process.argv.slice(2)
  if (action === 'stage') {
    const receipt = runReleaseStage(stage)
    console.log(`Release ${stage}: ${receipt.status}`)
    if (receipt.status !== 'PASS') process.exitCode = 1
    return
  }
  if (action === 'final') {
    const result = validateFinalReceipts()
    console.log(`Release evidence PASS: ${result.runId} ${result.gitSha.slice(0, 8)} ${result.productionOrigin}`)
    return
  }
  throw new Error('Use release-receipts.mjs stage <stage> or final')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { main() }
  catch (error) {
    console.error(safeReason(error))
    process.exitCode = 1
  }
}
