import { describe, it, expect, vi } from 'vitest'
import { accountInfrastructureReady, accountChecksEntitled, needsDisposableTest, accountObservationContext, collapseAccountObservations } from '../contracts'
import { flowFingerprint, testIdentity } from '../identity'
import { accountRequestAllowed, scopedSessionState } from '../browser'

const configured = { ACCOUNT_CHECKS_ENABLED: 'true', ACCOUNT_CHECKS_LIFECYCLE_VERIFIED: 'true', ACCOUNT_TEST_EMAIL: 'checks@inbound.example.com',
  TOKEN_ENCRYPTION_KEY: 'a'.repeat(64), RESEND_API_KEY: 'test-key', RESEND_RECEIVING_WEBHOOK_SECRET: 'test-secret' }
vi.mock('@/lib/audit/screenshot', () => ({ getAuditBrowser: vi.fn() }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: vi.fn() }))

describe('automatic account policy', () => {
  it('requires explicit lifecycle verification and complete infrastructure', () => {
    expect(accountInfrastructureReady(configured)).toBe(true)
    for (const key of Object.keys(configured)) expect(accountInfrastructureReady({ ...configured, [key]: undefined })).toBe(false)
    expect(accountInfrastructureReady({ ...configured, ACCOUNT_TEST_EMAIL: 'checks+tag@example.com' })).toBe(false)
  })
  it('grants beta capability to resolved accounts, never anonymous callers', () => {
    expect(accountChecksEntitled(null)).toBe(false)
    expect(accountChecksEntitled({ role: 'user', plan: 'FREE', subscriptionStatus: 'ACTIVE' })).toBe(true)
  })
  it('does not create disposable accounts during ordinary unchanged checks', () => {
    expect(needsDisposableTest({ mode: 'routine', fingerprint: 'same', previousFingerprint: 'same', state: 'DELETED' })).toBe(false)
    expect(needsDisposableTest({ mode: 'routine', fingerprint: 'changed', previousFingerprint: 'same', state: 'DELETED' })).toBe(true)
    expect(needsDisposableTest({ mode: 'retest', fingerprint: 'same', previousFingerprint: 'same', state: 'DELETED' })).toBe(true)
    for (const state of ['RESERVED', 'SUBMITTING', 'VERIFYING', 'ACTIVE', 'DELETING'])
      expect(needsDisposableTest({ mode: 'retest', fingerprint: 'changed', state })).toBe(false)
    expect(needsDisposableTest({ mode: 'cleanup', fingerprint: 'new' })).toBe(false)
  })
  it('keeps signed-in page contexts distinct and preserves a failed disposable test', () => {
    const base = { kind: 'signed_in' as const, state: 'verified' as const, detail: 'Inspected', pageUrl: 'https://example.com/dashboard', evidence: {} }
    expect(accountObservationContext(base)).not.toBe(accountObservationContext({ ...base, pageUrl: 'https://example.com/billing' }))
    expect(collapseAccountObservations([base, { ...base, state: 'failed', detail: 'Failed' }])).toEqual([{ ...base, state: 'failed', detail: 'Failed' }])
  })
  it('uses unique plus aliases without leaking the generated password', () => {
    const a = testIdentity('checks@inbound.example.com', 'identity_1'), b = testIdentity('checks@inbound.example.com', 'identity_2')
    expect(a.email).toBe('checks+ff-identity_1@inbound.example.com')
    expect(a.email).not.toBe(b.email); expect(a.password).not.toBe(b.password)
    expect(a.password.length).toBeGreaterThan(24)
  })
  it('fingerprints form semantics rather than URL tracking parameters', () => {
    const flow = { url: 'https://example.com/signup?tracking=1', action: 'https://example.com/api/signup',
      fields: [{ type: 'email', name: 'email', label: 'Email', autocomplete: 'email', required: true }] }
    expect(flowFingerprint(flow)).toBe(flowFingerprint({ ...flow, url: 'https://example.com/signup?tracking=2' }))
    expect(flowFingerprint(flow)).not.toBe(flowFingerprint({ ...flow, fields: [...flow.fields, { ...flow.fields[0], name: 'password', type: 'password' }] }))
  })
})
describe('account browser boundaries', () => {
  const request = { url: 'https://example.com/api/auth/signup', method: 'POST', navigation: false, origin: 'https://example.com', values: ['test@example.com'], action: 'signup' as const }
  it('allows the selected auth operation but blocks unrelated effects and other origins', () => {
    expect(accountRequestAllowed(request)).toBe(true)
    expect(accountRequestAllowed({ ...request, action: null })).toBe(false)
    for (const url of ['https://other.example/api/signup', 'https://example.com/api/payment', 'https://example.com/api/invite', 'https://example.com/api/posts'])
      expect(accountRequestAllowed({ ...request, url })).toBe(false)
    expect(accountRequestAllowed({ ...request, method: 'GET', navigation: true, url: 'https://example.com/delete-account', action: null })).toBe(false)
    expect(accountRequestAllowed({ ...request, method: 'GET', url: 'https://third.example/beacon?email=test%40example.com' })).toBe(false)
  })
  it('keeps read-only signed-in browsing free of account mutations', () => {
    expect(accountRequestAllowed({ ...request, action: null, method: 'GET', url: 'https://example.com/dashboard' })).toBe(true)
    expect(accountRequestAllowed({ ...request, action: 'delete', url: 'https://example.com/api/account/delete' })).toBe(true)
  })
  it('scopes persisted cookies and local storage to the owning origin', () => {
    const cookie = { name: 'session', value: 'secret', domain: 'example.com', path: '/', expires: -1, httpOnly: true, secure: true, sameSite: 'Lax' }
    const state = scopedSessionState({ cookies: [cookie, { ...cookie, domain: 'other.example' }],
      origins: [{ origin: 'https://example.com', localStorage: [] }, { origin: 'https://other.example', localStorage: [] }] }, 'https://example.com')
    expect(state.cookies).toHaveLength(1); expect(state.origins).toHaveLength(1)
  })
})
