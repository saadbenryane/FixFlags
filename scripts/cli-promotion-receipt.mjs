#!/usr/bin/env node

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRegistryMetadata } from './verify-cli-registry.mjs'

export const PROMOTED_CLI_VERSION = '1.0.5'

export function buildPromotionReceipt(metadata, context) {
  const version = context.version
  if (version !== PROMOTED_CLI_VERSION) {
    throw new Error(`Promotion is locked to fixflags@${PROMOTED_CLI_VERSION}`)
  }
  if (!/^[a-f0-9]{40}$/.test(context.gitSha ?? '')) {
    throw new Error('Promotion receipt requires the full candidate Git SHA')
  }
  if (!context.githubRunId || !context.githubRunAttempt) {
    throw new Error('Promotion receipt requires GitHub run identity')
  }
  const candidate = validateRegistryMetadata(metadata, version, 'candidate', context.gitSha)
  const latest = validateRegistryMetadata(metadata, version, 'latest', context.gitSha)
  if (candidate.integrity !== latest.integrity || candidate.tarball !== latest.tarball) {
    throw new Error('candidate and latest do not resolve to the same immutable package')
  }
  return {
    schemaVersion: 1,
    packageName: 'fixflags',
    version,
    candidateVersion: metadata['dist-tags']?.candidate,
    latestVersion: metadata['dist-tags']?.latest,
    integrity: candidate.integrity,
    tarball: candidate.tarball,
    gitSha: context.gitSha,
    githubRun: {
      id: context.githubRunId,
      attempt: context.githubRunAttempt,
      workflowRef: context.githubWorkflowRef ?? null,
    },
    promotedAt: context.promotedAt ?? new Date().toISOString(),
  }
}

async function main() {
  const output = process.env.RELEASE_PROMOTION_RECEIPT_FILE
  if (!output) throw new Error('RELEASE_PROMOTION_RECEIPT_FILE is required')
  const version = process.env.RELEASE_CLI_VERSION
  const response = await fetch('https://registry.npmjs.org/fixflags')
  if (!response.ok) throw new Error(`npm registry request failed (${response.status})`)
  const metadata = await response.json()
  const receipt = buildPromotionReceipt(metadata, {
    version,
    gitSha: process.env.RELEASE_EXPECTED_GIT_SHA,
    githubRunId: process.env.GITHUB_RUN_ID,
    githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
    githubWorkflowRef: process.env.GITHUB_WORKFLOW_REF,
  })
  mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 })
  writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 })
  chmodSync(output, 0o600)
  console.log(`Promotion receipt PASS for fixflags@${version}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
