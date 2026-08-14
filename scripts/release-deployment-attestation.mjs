#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function runJson(executable, args) {
  return JSON.parse(execFileSync(executable, args, { encoding: 'utf8' }))
}

function currentGitSha() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

function matchingDeployment(service, environment, gitSha) {
  const deployments = runJson('railway', [
    'deployment', 'list', '--service', service, '--environment', environment, '--json',
  ])
  const deployment = deployments.find((candidate) => candidate?.meta?.commitHash === gitSha)
  if (!deployment) throw new Error(`${service} has no deployment for the candidate revision`)
  if (deployment.status !== 'SUCCESS') throw new Error(`${service} candidate deployment is not successful`)
  return {
    service,
    deploymentId: deployment.id,
    role: service === (process.env.RELEASE_RAILWAY_WORKER_SERVICE || 'FixFlags Worker')
      ? 'worker'
      : 'web',
    state: deployment.status,
    gitSha: deployment.meta.commitHash,
    imageDigest: deployment.meta.imageDigest ?? null,
    deployedAt: deployment.createdAt,
  }
}

function main() {
  const target = process.env.RELEASE_DEPLOYMENT_EVIDENCE_FILE
  if (!target) throw new Error('RELEASE_DEPLOYMENT_EVIDENCE_FILE is required')
  const gitSha = currentGitSha()
  const repository = process.env.RELEASE_GITHUB_REPOSITORY || 'saadbenryane/FixFlags'
  const checkRuns = runJson('gh', ['api', `repos/${repository}/commits/${gitSha}/check-runs`])
    .check_runs ?? []
  const successfulChecks = checkRuns.filter(
    (check) => check.status === 'completed' && check.conclusion === 'success',
  )
  if (successfulChecks.length === 0) {
    throw new Error('The candidate revision has no successful completed GitHub check run')
  }
  if (checkRuns.some((check) => check.status !== 'completed' || check.conclusion !== 'success')) {
    throw new Error('The candidate revision has incomplete, skipped, or failed GitHub checks')
  }

  const environment = process.env.RELEASE_RAILWAY_ENVIRONMENT || 'production'
  const services = [
    matchingDeployment(process.env.RELEASE_RAILWAY_WEB_SERVICE || 'QewOS', environment, gitSha),
    matchingDeployment(process.env.RELEASE_RAILWAY_WORKER_SERVICE || 'FixFlags Worker', environment, gitSha),
  ]
  const lastCheckAt = successfulChecks
    .map((check) => Date.parse(check.completed_at))
    .reduce((latest, value) => Math.max(latest, value), 0)
  if (services.some((service) => Date.parse(service.deployedAt) < lastCheckAt)) {
    throw new Error('A candidate deployment started before its successful CI proof completed')
  }

  const evidence = {
    schemaVersion: 1,
    gitSha,
    repository,
    ci: {
      status: 'SUCCESS',
      checks: successfulChecks.map((check) => ({
        name: check.name,
        completedAt: check.completed_at,
      })),
    },
    services,
  }
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log(`Deployment attestation PASS for ${gitSha.slice(0, 8)}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
