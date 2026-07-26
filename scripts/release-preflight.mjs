#!/usr/bin/env node

const required = [
  'RELEASE_FRESH_DATABASE_URL',
  'RELEASE_CONTAINER_ENV_FILE',
  'RELEASE_SMOKE_URL',
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
  'E2E_WATCH_EMAIL',
  'E2E_WATCH_PASSWORD',
  'E2E_WATCH_PROJECT_ID',
  'E2E_WATCH_MAILBOX_ASSERT_URL',
  'E2E_GITHUB_EMAIL',
  'E2E_GITHUB_PASSWORD',
  'E2E_GITHUB_REPOSITORY',
  'E2E_API_KEY',
]

const missing = required.filter((name) => !process.env[name]?.trim())
if (process.env.RELEASE_ALLOW_DATABASE_RESET !== 'true') {
  missing.push('RELEASE_ALLOW_DATABASE_RESET=true')
}

if (missing.length > 0) {
  console.error('Release verification is blocked. Missing sandbox inputs:')
  for (const name of missing) console.error(`- ${name}`)
  process.exit(1)
}

console.log('Release preflight passed: disposable database consent and sandbox fixtures are present.')
