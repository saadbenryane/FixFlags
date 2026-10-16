#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { chmodSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { releaseStageCommands } from './release-receipts.mjs'

function runJson(executable, args) {
  return JSON.parse(execFileSync(executable, args, { encoding: 'utf8' }))
}

function currentGitSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

export function attestSuccessfulChecks(checkRuns) {
  if (!Array.isArray(checkRuns) || checkRuns.length === 0) {
    throw new Error('The candidate revision has no GitHub check runs')
  }
  if (checkRuns.some((check) => check.status !== 'completed' || check.conclusion !== 'success')) {
    throw new Error('The candidate revision has incomplete, skipped, or failed GitHub checks')
  }
  const completedAt = checkRuns
    .map((check) => Date.parse(check.completed_at))
    .reduce((latest, value) => Math.max(latest, value), 0)
  if (!Number.isFinite(completedAt) || completedAt <= 0) {
    throw new Error('GitHub checks have no valid completion timestamp')
  }
  return {
    status: 'SUCCESS',
    completedAt: new Date(completedAt).toISOString(),
    checks: checkRuns.map((check) => ({
      name: check.name,
      completedAt: check.completed_at,
    })),
  }
}

export function attestLocalFoundation(receipt, gitSha) {
  const labels = releaseStageCommands('foundation').map(([label]) => label)
  if (receipt?.schemaVersion !== 2 || receipt.stage !== 'foundation' || receipt.status !== 'PASS' || receipt.profile !== 'free-launch' || receipt.gitSha !== gitSha)
    throw new Error('Local foundation proof must be a passing free-launch receipt for the exact candidate')
  if (JSON.stringify(receipt.commands?.map(command => command.label)) !== JSON.stringify(labels) || receipt.commands.some(command => command.exitCode !== 0))
    throw new Error('Local foundation command proof is incomplete or failed')
  if (!/^sha256:[a-f0-9]{64}$/.test(receipt.containerImageDigest ?? '') || !Number.isFinite(Date.parse(receipt.completedAt)) ||
    !Number.isFinite(Date.parse(receipt.startedAt)) || Date.parse(receipt.completedAt) <= Date.parse(receipt.startedAt))
    throw new Error('Local foundation image or completion evidence is invalid')
  if (!/^[a-f0-9]{40}$/.test(receipt.previousGitSha ?? '') || !receipt.artifacts?.some(artifact => artifact.label === 'upgrade-evidence' && /^[a-f0-9]{64}$/.test(artifact.sha256)))
    throw new Error('Local foundation has no exact previous-schema upgrade evidence')
  return { source: 'local-foundation', status: 'SUCCESS', completedAt: receipt.completedAt, runId: receipt.runId,
    containerImageDigest: receipt.containerImageDigest }
}

export function attestRailwayDeployment({ deployments, service, role, gitSha, ciCompletedAt, verificationCompletedAt }) {
  const deployment = deployments
    .filter((candidate) => candidate?.meta?.commitHash === gitSha)
    .sort((left, right) => Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? ''))[0]
  if (!deployment) throw new Error(`${service} has no deployment for the exact candidate revision`)
  if (deployment.status !== 'SUCCESS') {
    throw new Error(`${service} candidate deployment is not successful`)
  }
  const transitionedAt = deployment.updatedAt
  const provenAt = verificationCompletedAt ?? ciCompletedAt
  if (!transitionedAt || !Number.isFinite(Date.parse(provenAt)) || !Number.isFinite(Date.parse(transitionedAt)) || Date.parse(transitionedAt) <= Date.parse(provenAt)) {
    throw new Error(`${service} has no successful ${verificationCompletedAt ? 'post-verification' : 'post-CI'} deployment transition`)
  }
  return {
    service,
    deploymentId: deployment.id,
    role,
    state: deployment.status,
    gitSha: deployment.meta.commitHash,
    imageDigest: deployment.meta.imageDigest ?? null,
    createdAt: deployment.createdAt ?? null,
    transitionedAt,
  }
}

export function buildDeploymentAttestation({ gitSha, repository, checkRuns, localFoundation, deploymentsByRole }) {
  if (!/^[a-f0-9]{40}$/.test(gitSha)) throw new Error('Candidate revision must be a full Git SHA')
  const verification = localFoundation ? attestLocalFoundation(localFoundation, gitSha) : { source: 'github-checks', ...attestSuccessfulChecks(checkRuns) }
  const services = ['web', 'worker'].map((role) => {
    const input = deploymentsByRole[role]
    if (!input) throw new Error(`${role} Railway deployment evidence is missing`)
    return attestRailwayDeployment({
      deployments: input.deployments,
      service: input.service,
      role,
      gitSha,
      verificationCompletedAt: verification.completedAt,
    })
  })
  return {
    schemaVersion: localFoundation ? 3 : 2,
    gitSha,
    repository,
    ...(localFoundation ? { verification } : { ci: verification }),
    services,
  }
}

function main() {
  const target = process.env.RELEASE_DEPLOYMENT_EVIDENCE_FILE
  if (!target) throw new Error('RELEASE_DEPLOYMENT_EVIDENCE_FILE is required')
  const gitSha = currentGitSha()
  const repository = process.env.RELEASE_GITHUB_REPOSITORY || 'saadbenryane/FixFlags'
  const proofSource = process.env.RELEASE_DEPLOYMENT_PROOF ?? 'local-foundation'
  if (!['local-foundation', 'github-checks'].includes(proofSource)) throw new Error('Unknown deployment proof source')
  let localFoundation
  let foundationHash
  if (proofSource === 'local-foundation') {
    const file = process.env.RELEASE_FOUNDATION_RECEIPT_FILE ?? path.join(path.dirname(target), 'foundation.json')
    const stat = lstatSync(file)
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error('Local foundation receipt must be a private regular file')
    const bytes = readFileSync(file)
    localFoundation = JSON.parse(bytes.toString('utf8'))
    foundationHash = createHash('sha256').update(bytes).digest('hex')
  }
  const checkRunPages = proofSource === 'github-checks' ? runJson('gh', [
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/commits/${gitSha}/check-runs?per_page=100`,
  ]) : []
  const checkRuns = checkRunPages.flatMap((page) => page.check_runs ?? [])
  const environment = process.env.RELEASE_RAILWAY_ENVIRONMENT || 'production'
  const webService = process.env.RELEASE_RAILWAY_WEB_SERVICE || 'FixFlags'
  const workerService = process.env.RELEASE_RAILWAY_WORKER_SERVICE || 'FixFlags Worker'
  const loadDeployments = (service) => runJson('railway', [
    'deployment',
    'list',
    '--service',
    service,
    '--environment',
    environment,
    '--json',
  ])
  const evidence = buildDeploymentAttestation({
    gitSha,
    repository,
    checkRuns,
    localFoundation,
    deploymentsByRole: {
      web: { service: webService, deployments: loadDeployments(webService) },
      worker: { service: workerService, deployments: loadDeployments(workerService) },
    },
  })
  if (foundationHash) evidence.verification.receiptSha256 = foundationHash
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log(`Deployment attestation PASS for ${gitSha.slice(0, 8)}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
