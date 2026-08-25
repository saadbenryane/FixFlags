#!/usr/bin/env node

import { existsSync, lstatSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const RELEASE_STAGES = [
  'foundation',
  'fixture-binding',
  'credentialed-core',
  'billing-open',
  'billing-closed',
  'external',
  'deployed',
]

export const FOUNDATION_INPUTS = [
  'RELEASE_FRESH_DATABASE_URL',
  'RELEASE_CONTAINER_ENV_FILE',
]

export const FIXTURE_BINDING_INPUTS = [
  'RELEASE_E2E_TARGET',
  'RELEASE_ENV_URL',
  'RELEASE_FRESH_DATABASE_URL',
  'RELEASE_FIXTURE_MANIFEST',
]

export const CREDENTIALED_CORE_INPUTS = [
  'RELEASE_ENV_URL',
  'RELEASE_FIXTURE_MANIFEST',
  'E2E_AUDIT_URL',
  'E2E_SIGNUP_PASSWORD',
  'E2E_2FA_EMAIL',
  'E2E_2FA_PASSWORD',
  'E2E_2FA_BACKUP_CODE',
  'E2E_WEBAUTHN_CREDENTIAL_ID',
  'E2E_WEBAUTHN_PRIVATE_KEY',
  'E2E_WEBAUTHN_USER_HANDLE',
  'E2E_BILLING_FREE_EMAIL',
  'E2E_BILLING_FREE_PASSWORD',
  'E2E_BILLING_PAID_EMAIL',
  'E2E_BILLING_PAID_PASSWORD',
  'E2E_SHARE_OWNER_EMAIL',
  'E2E_SHARE_OWNER_PASSWORD',
  'E2E_SHARE_REPORT_ID',
  'E2E_SHARE_PASSWORD',
  'E2E_FREE_REPORT_ID',
  'E2E_PRO_EMAIL',
  'E2E_PRO_PASSWORD',
  'E2E_PRO_REPORT_ID',
  'E2E_STUDIO_EMAIL',
  'E2E_STUDIO_PASSWORD',
]

export const BILLING_OPEN_INPUTS = [
  'RELEASE_ENV_URL',
  'RELEASE_FIXTURE_MANIFEST',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_GATE_MEMBER_RELEASED_ENTRY_ID',
  'E2E_GATE_MEMBER_BLOCKED_ENTRY_ID',
  'E2E_STRIPE_SECRET_KEY',
]

export const BILLING_CLOSED_INPUTS = [
  ...BILLING_OPEN_INPUTS,
  'E2E_REVOKED_EMAIL',
  'E2E_REVOKED_PASSWORD',
  'E2E_REVOKED_REPORT_ID',
]

export const EXTERNAL_INPUTS = [
  'RELEASE_ENV_URL',
  'RELEASE_ENV_API_KEY',
  'RELEASE_FIXTURE_MANIFEST',
  'E2E_WATCH_EMAIL',
  'E2E_WATCH_PASSWORD',
  'E2E_WATCH_PROJECT_ID',
  'E2E_WATCH_MAILBOX_ASSERT_URL',
]

export const DEPLOYED_INPUTS = ['PRODUCTION_URL']

const STAGE_INPUTS = {
  foundation: FOUNDATION_INPUTS,
  'fixture-binding': FIXTURE_BINDING_INPUTS,
  'credentialed-core': CREDENTIALED_CORE_INPUTS,
  'billing-open': BILLING_OPEN_INPUTS,
  'billing-closed': BILLING_CLOSED_INPUTS,
  external: EXTERNAL_INPUTS,
  deployed: DEPLOYED_INPUTS,
}

export const REQUIRED_RELEASE_INPUTS = [
  ...new Set(Object.values(STAGE_INPUTS).flat()),
]

function normalizedOrigin(name, value, issues) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') issues.push(`${name} must use https`)
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      issues.push(`${name} must be a clean origin without credentials, path, query, or fragment`)
    }
    return url.origin
  } catch {
    issues.push(`${name} must be a valid URL`)
    return null
  }
}

export function canonicalDatabaseIdentity(value) {
  const url = new URL(value)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('database URL must use postgresql')
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!database) throw new Error('database URL must name a database')
  const port = url.port || '5432'
  return `${url.hostname.toLowerCase()}:${port}/${database.toLowerCase()}`
}

function validateFoundation(env, issues, checkFile) {
  if (env.RELEASE_ALLOW_DATABASE_RESET !== 'true') {
    issues.push('Missing RELEASE_ALLOW_DATABASE_RESET=true')
  }
  if (env.RELEASE_FRESH_DATABASE_URL) {
    try {
      const identity = canonicalDatabaseIdentity(env.RELEASE_FRESH_DATABASE_URL)
      const databaseName = identity.slice(identity.lastIndexOf('/') + 1)
      if (!/(?:release|test)/.test(databaseName)) {
        issues.push('RELEASE_FRESH_DATABASE_URL database name must include release or test')
      }
      if (
        env.DATABASE_URL &&
        identity === canonicalDatabaseIdentity(env.DATABASE_URL)
      ) {
        issues.push('RELEASE_FRESH_DATABASE_URL must not identify the DATABASE_URL database')
      }
    } catch (error) {
      issues.push(
        `RELEASE_FRESH_DATABASE_URL ${error instanceof Error ? error.message : 'must be valid'}`
      )
    }
  }
  if (!env.RELEASE_CONTAINER_ENV_FILE || !checkFile) return
  if (!existsSync(env.RELEASE_CONTAINER_ENV_FILE)) {
    issues.push('RELEASE_CONTAINER_ENV_FILE does not exist')
    return
  }
  if (lstatSync(env.RELEASE_CONTAINER_ENV_FILE).isSymbolicLink()) {
    issues.push('RELEASE_CONTAINER_ENV_FILE must not be a symbolic link')
    return
  }
  const stat = statSync(env.RELEASE_CONTAINER_ENV_FILE)
  if (!stat.isFile()) issues.push('RELEASE_CONTAINER_ENV_FILE must be a regular file')
  if ((stat.mode & 0o077) !== 0) {
    issues.push('RELEASE_CONTAINER_ENV_FILE must not be accessible by group/others (chmod 600)')
  }
}

function validateReleaseOrigin(env, issues) {
  const release = env.RELEASE_ENV_URL
    ? normalizedOrigin('RELEASE_ENV_URL', env.RELEASE_ENV_URL, issues)
    : null
  if (release && ['fixflags.com', 'www.fixflags.com'].includes(new URL(release).hostname)) {
    issues.push('RELEASE_ENV_URL must not target the canonical production origin')
  }
}

function validateReleaseEnvironmentBinding(env, issues) {
  if (env.RELEASE_E2E_TARGET !== 'remote') {
    issues.push('RELEASE_E2E_TARGET must equal remote')
  }
  validateReleaseOrigin(env, issues)
}

function validateProductionBinding(env, issues) {
  const production = env.PRODUCTION_URL
    ? normalizedOrigin('PRODUCTION_URL', env.PRODUCTION_URL, issues)
    : null
  if (production && !['fixflags.com', 'www.fixflags.com'].includes(new URL(production).hostname)) {
    issues.push('PRODUCTION_URL must target the canonical production origin')
  }
  const release = env.RELEASE_ENV_URL
    ? normalizedOrigin('RELEASE_ENV_URL', env.RELEASE_ENV_URL, issues)
    : null
  if (production && release && production === release) {
    issues.push('PRODUCTION_URL must not equal RELEASE_ENV_URL')
  }
  if (
    env.PRODUCTION_API_KEY &&
    env.RELEASE_ENV_API_KEY &&
    env.PRODUCTION_API_KEY === env.RELEASE_ENV_API_KEY
  ) {
    issues.push('PRODUCTION_API_KEY must not equal RELEASE_ENV_API_KEY')
  }
}

export function validateReleasePreflight(
  env,
  options = {}
) {
  const stage = options.stage ?? 'foundation'
  if (!RELEASE_STAGES.includes(stage)) {
    return [`Unknown release stage: ${stage}`]
  }
  const typedStage = stage
  const issues = STAGE_INPUTS[typedStage]
    .filter((name) => !env[name]?.trim())
    .map((name) => `Missing ${name}`)

  if (typedStage === 'foundation') {
    validateFoundation(env, issues, options.checkFile !== false)
  }
  if (typedStage === 'fixture-binding') {
    validateReleaseEnvironmentBinding(env, issues)
  }
  if (['credentialed-core', 'billing-open', 'billing-closed', 'external'].includes(typedStage)) {
    validateReleaseOrigin(env, issues)
  }
  if (typedStage === 'deployed') {
    validateProductionBinding(env, issues)
  }
  if (typedStage === 'billing-open' && env.E2E_PAID_OPEN_EXPECTED !== 'true') {
    issues.push('E2E_PAID_OPEN_EXPECTED must equal true for billing-open')
  }
  if (typedStage === 'billing-closed' && env.E2E_PAID_OPEN_EXPECTED !== 'false') {
    issues.push('E2E_PAID_OPEN_EXPECTED must equal false for billing-closed')
  }
  if (['billing-open', 'billing-closed'].includes(typedStage) && env.E2E_STRIPE_SECRET_KEY) {
    if (!env.E2E_STRIPE_SECRET_KEY.startsWith('sk_test_')) {
      issues.push('E2E_STRIPE_SECRET_KEY must be a Stripe test-mode key')
    }
  }
  if (typedStage === 'external' && env.E2E_WATCH_MAILBOX_ASSERT_URL) {
    normalizedOrigin(
      'E2E_WATCH_MAILBOX_ASSERT_URL',
      env.E2E_WATCH_MAILBOX_ASSERT_URL,
      issues
    )
  }
  return issues
}

function main() {
  const stageIndex = process.argv.indexOf('--stage')
  const stage = stageIndex >= 0 ? process.argv[stageIndex + 1] : 'foundation'
  const issues = validateReleasePreflight(process.env, { stage })
  if (issues.length > 0) {
    console.error('Release verification is blocked. Resolve these release-contract failures:')
    for (const issue of issues) console.error(`- ${issue}`)
    process.exitCode = 1
    return
  }
  console.log(`Release ${stage} preflight passed.`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
