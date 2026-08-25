import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { canonicalDatabaseIdentity, CREDENTIALED_CORE_INPUTS, REQUIRED_RELEASE_INPUTS, validateReleasePreflight } from './release-preflight.mjs'

function validEnv(overrides = {}) {
  return {
    ...Object.fromEntries(REQUIRED_RELEASE_INPUTS.map((name) => [name, `value-${name}`])),
    RELEASE_ALLOW_DATABASE_RESET: 'true',
    RELEASE_E2E_TARGET: 'remote',
    RELEASE_FRESH_DATABASE_URL: 'postgresql://release:test@db.test/fixflags_release?sslmode=require',
    RELEASE_CONTAINER_ENV_FILE: '/tmp/release-container.env',
    RELEASE_FIXTURE_MANIFEST: '/tmp/release-fixtures.json',
    RELEASE_ENV_URL: 'https://release.fixflags.test',
    RELEASE_ENV_API_KEY: 'ff_release_fixture',
    PRODUCTION_URL: 'https://fixflags.com',
    PRODUCTION_API_KEY: 'ff_production_fixture',
    E2E_STRIPE_SECRET_KEY: 'sk_test_release_fixture',
    E2E_PAID_OPEN_EXPECTED: 'true',
    ...overrides,
  }
}

describe('release preflight contract', () => {
  it('uses canonical database identity independent of credentials and query parameters', () => {
    assert.equal(
      canonicalDatabaseIdentity('postgresql://a:x@DB.TEST/fixflags_release?sslmode=require'),
      canonicalDatabaseIdentity('postgres://b:y@db.test:5432/fixflags_release?schema=public'),
    )
  })

  it('rejects the same database even when URL decoration differs', () => {
    const issues = validateReleasePreflight(validEnv({ DATABASE_URL: 'postgres://other@db.test:5432/fixflags_release' }), { checkFile: false, stage: 'foundation' })
    assert.ok(issues.some((issue) => issue.includes('must not identify')))
  })

  it('keeps release fixtures off the canonical production origin', () => {
    const issues = validateReleasePreflight(validEnv({ RELEASE_ENV_URL: 'https://fixflags.com' }), { checkFile: false, stage: 'fixture-binding' })
    assert.ok(issues.some((issue) => issue.includes('must not target the canonical production origin')))
  })

  it('requires a distinct canonical production target and credential', () => {
    assert.deepEqual(validateReleasePreflight(validEnv(), { checkFile: false, stage: 'registry-cli' }), [])
    assert.ok(validateReleasePreflight(validEnv({ PRODUCTION_URL: 'https://preview.fixflags.test' }), { checkFile: false, stage: 'registry-cli' }).some((issue) => issue.includes('canonical production origin')))
    assert.ok(validateReleasePreflight(validEnv({ PRODUCTION_API_KEY: 'same', RELEASE_ENV_API_KEY: 'same' }), { checkFile: false, stage: 'registry-cli' }).some((issue) => issue.includes('must not equal RELEASE_ENV_API_KEY')))
  })

  it('does not accept the legacy shared smoke variables in place of separated targets', () => {
    const env = validEnv({ RELEASE_SMOKE_URL: 'https://release.fixflags.test', E2E_BASE_URL: 'https://release.fixflags.test' })
    delete env.RELEASE_ENV_URL
    assert.ok(validateReleasePreflight(env, { checkFile: false, stage: 'fixture-binding' }).some((issue) => issue === 'Missing RELEASE_ENV_URL'))
    delete env.PRODUCTION_URL
    assert.ok(validateReleasePreflight(env, { checkFile: false, stage: 'deployed' }).some((issue) => issue === 'Missing PRODUCTION_URL'))
  })

  it('keeps unrelated credential requirements out of foundation', () => {
    const env = validEnv()
    for (const name of CREDENTIALED_CORE_INPUTS) delete env[name]
    assert.deepEqual(validateReleasePreflight(env, { checkFile: false, stage: 'foundation' }), [])
  })

  it('rejects live Stripe keys in billing-open', () => {
    const issues = validateReleasePreflight(validEnv({ E2E_STRIPE_SECRET_KEY: 'sk_live_secret' }), { checkFile: false, stage: 'billing-open' })
    assert.ok(issues.some((issue) => issue.includes('test-mode')))
  })

  it('binds paid-open and paid-closed billing stages to immutable opposite configs', () => {
    assert.deepEqual(validateReleasePreflight(validEnv(), { checkFile: false, stage: 'billing-open' }), [])
    const closed = validEnv({
      E2E_PAID_OPEN_EXPECTED: 'false',
      E2E_REVOKED_EMAIL: 'revoked@example.test',
      E2E_REVOKED_PASSWORD: 'fixture',
      E2E_REVOKED_REPORT_ID: 'report',
    })
    assert.deepEqual(validateReleasePreflight(closed, { checkFile: false, stage: 'billing-closed' }), [])
    assert.ok(validateReleasePreflight(validEnv(), { checkFile: false, stage: 'billing-closed' }).some((issue) => issue.includes('must equal false')))
  })
})
