import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectToolchainAudit } from './security-audit.mjs'

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
