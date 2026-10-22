import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectToolchainAudit, parseAuditCommandResult } from './security-audit.mjs'

const braces = {
  severity: 'high',
  isDirect: false,
  via: [{ url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm' }],
}

test('accepts only the exact reviewed build-only braces advisory', () => {
  assert.deepEqual(inspectToolchainAudit({ vulnerabilities: { braces } }), [])
  assert.deepEqual(inspectToolchainAudit({
    vulnerabilities: {
      braces,
      micromatch: { severity: 'high', isDirect: false, via: ['braces'] },
      tailwindcss: { severity: 'high', isDirect: true, via: ['micromatch'] },
    },
  }), [])
})

test('rejects direct, new, and unrelated vulnerabilities', () => {
  assert.equal(inspectToolchainAudit({ vulnerabilities: { braces: { ...braces, isDirect: true } } }).length, 1)
  assert.equal(inspectToolchainAudit({ vulnerabilities: { braces: { ...braces, via: [{ url: 'https://example.com/new' }] } } }).length, 1)
  assert.equal(inspectToolchainAudit({ vulnerabilities: { other: braces } }).length, 1)
})

test('fails closed on provider errors in either audit phase without labelling missing evidence as a vulnerability', () => {
  for (const phase of ['Runtime', 'Toolchain']) {
    for (const status of [0, 1]) assert.throws(() => parseAuditCommandResult({ status,
      stdout: JSON.stringify({ error: { code: 'E503', summary: 'Provider unavailable' } }) }, phase),
    new RegExp(`${phase} dependency audit unavailable \\(E503\\)`))
    assert.throws(() => parseAuditCommandResult({ status: 1, stdout: '{}' }, phase), /unavailable/)
    assert.throws(() => parseAuditCommandResult({ status: 0, stdout: 'not JSON' }, phase), /unavailable \(INVALID_JSON\)/)
    assert.throws(() => parseAuditCommandResult({ status: null, stdout: '', error: { code: 'ETIMEDOUT' } }, phase), /unavailable \(ETIMEDOUT\)/)
  }
})

test('requires a complete audit report and retains the exact reviewed toolchain findings', () => {
  const report = { auditReportVersion: 2, vulnerabilities: { braces }, metadata: { vulnerabilities: { total: 1, info: 0, low: 0, moderate: 0, high: 1, critical: 0 } } }
  const actual = parseAuditCommandResult({ status: 1, stdout: JSON.stringify(report) }, 'Toolchain')
  assert.deepEqual(actual, { status: 1, report })
  assert.deepEqual(inspectToolchainAudit(actual.report), [])
  const clean = { ...report, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 } } }
  assert.throws(() => parseAuditCommandResult({ status: 0, stdout: JSON.stringify({ ...clean, metadata: { vulnerabilities: { total: 0 } } }) }, 'Runtime'), /unavailable \(INVALID_REPORT\)/)
  assert.throws(() => parseAuditCommandResult({ status: 0, stdout: JSON.stringify({ ...clean, vulnerabilities: { braces } }) }, 'Toolchain'), /unavailable \(INVALID_REPORT\)/)
  assert.throws(() => parseAuditCommandResult({ status: 1, stdout: JSON.stringify(clean) }, 'Runtime'), /unavailable \(COMMAND_FAILED\)/)
  assert.equal(parseAuditCommandResult({ status: 0, stdout: JSON.stringify(clean) }, 'Runtime').status, 0)
})
