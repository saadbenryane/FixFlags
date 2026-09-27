import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  executeProductCommand: vi.fn(),
  enforceRateLimit: vi.fn(),
  ingestProductSignals: vi.fn(),
  isProductSignalOriginAllowed: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/products/application/commands', () => ({
  executeProductCommand: mocks.executeProductCommand,
}))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  requestClientId: () => 'client-1',
}))
vi.mock('@/lib/signals/product-signals', () => ({
  ingestProductSignals: mocks.ingestProductSignals,
  isProductSignalOriginAllowed: mocks.isProductSignalOriginAllowed,
  normalizeSignalOrigin: (origin: string) => origin,
}))

import { POST as recordAttempt } from '@/app/api/flags/[id]/attempts/route'
import { POST as ingestSignals } from '@/app/api/products/[id]/signals/route'

/**
 * These two routes still ship for legacy report and Product compatibility, but
 * their report-era release journeys were retired. Their remaining risk is
 * authorization, validation, and origin enforcement, so that is what is proven
 * here: a legacy surface nobody journey-tested must not be a surface nobody
 * tested.
 */

const attemptContext = { params: Promise.resolve({ id: 'flag-1' }) }
const signalContext = { params: Promise.resolve({ id: 'project-1' }) }

function attemptRequest(body: unknown): Request {
  return new Request('http://localhost/api/flags/flag-1/attempts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function signalRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/products/project-1/signals', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/flags/[id]/attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.executeProductCommand.mockImplementation(async (input: { action: string }) => ({
      flagId: 'flag-1',
      action: input.action,
      productId: 'project-1',
      improvementId: 'improvement-1',
      attemptId: null,
      sourceReviewId: 'audit-1',
      rejectionReason: null,
      nextAction: { type: 'NONE' as const },
    }))
  })

  it('records an owner attempt without ever changing the verdict', async () => {
    const response = await recordAttempt(
      attemptRequest({ builder: 'copy', action: 'READY_TO_VERIFY', changeSummary: 'Repaired checkout' }),
      attemptContext,
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      attempt: { action: string; improvementId: string; attemptId: string | null }
    }
    expect(body.attempt).toMatchObject({ action: 'READY_TO_VERIFY', improvementId: 'improvement-1' })
    // Recording a change stores context. It never carries a verdict, and it is
    // not itself the proof that the fix worked.
    expect(body.attempt.attemptId).toBeNull()
    expect(mocks.executeProductCommand).toHaveBeenCalledWith({
      type: 'RECORD_FLAG_ACTION',
      flagId: 'flag-1',
      userId: 'user-1',
      builder: 'copy',
      action: 'READY_TO_VERIFY',
      changeSummary: 'Repaired checkout',
    })
  })

  it('refuses an unauthenticated attempt', async () => {
    mocks.getSession.mockResolvedValue(null)
    const response = await recordAttempt(attemptRequest({ builder: 'copy', action: 'HANDOFF_COPIED' }), attemptContext)
    expect(response.status).toBe(401)
    expect(mocks.executeProductCommand).not.toHaveBeenCalled()
  })

  it('requires the change context a ready-to-verify attempt must carry', async () => {
    const missingSummary = await recordAttempt(
      attemptRequest({ builder: 'copy', action: 'READY_TO_VERIFY' }),
      attemptContext,
    )
    const missingReason = await recordAttempt(
      attemptRequest({ builder: 'copy', action: 'REJECT' }),
      attemptContext,
    )

    expect(missingSummary.status).toBe(400)
    expect(missingReason.status).toBe(400)
    expect(mocks.executeProductCommand).not.toHaveBeenCalled()
  })

  it('does not disclose whether a Flag exists to a caller who does not own it', async () => {
    mocks.executeProductCommand.mockRejectedValue(new Error('Flag is not part of an owned Product'))
    const response = await recordAttempt(attemptRequest({ builder: 'copy', action: 'HANDOFF_COPIED' }), attemptContext)
    expect(response.status).toBe(404)
  })
})

describe('POST /api/products/[id]/signals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ingestProductSignals.mockResolvedValue({ accepted: 1, rejected: 0 })
  })

  it('accepts a Signal batch only from an allowed origin', async () => {
    const response = await ingestSignals(
      signalRequest(
        { key: 'secret-key', events: [{ id: 'e1', kind: 'NAVIGATION', name: 'opened', occurredAt: new Date().toISOString() }] },
        { origin: 'https://shop.example' },
      ),
      signalContext,
    )

    expect(response.status).toBe(202)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://shop.example')
    expect(await response.json()).toMatchObject({ accepted: 1 })
  })

  it('rejects a Signal batch with no origin, because a Signal proves nothing without its site', async () => {
    const response = await ingestSignals(signalRequest({ key: 'secret-key', events: [] }), signalContext)
    expect(response.status).toBe(403)
    expect(mocks.ingestProductSignals).not.toHaveBeenCalled()
  })

  it('never echoes the Signal key back to the caller', async () => {
    const response = await ingestSignals(
      signalRequest(
        { key: 'secret-key', events: [{ id: 'e1', kind: 'NAVIGATION', name: 'opened', occurredAt: new Date().toISOString() }] },
        { origin: 'https://shop.example' },
      ),
      signalContext,
    )
    const body = await response.text()
    expect(body).not.toContain('secret-key')
  })

  it('rejects a malformed batch and an oversized batch before ingestion', async () => {
    const malformed = await ingestSignals(signalRequest('{not json', { origin: 'https://shop.example' }), signalContext)
    const oversized = await ingestSignals(
      signalRequest(JSON.stringify({ key: 'k', events: [], pad: 'x'.repeat(120_000) }), {
        origin: 'https://shop.example',
      }),
      signalContext,
    )

    expect(malformed.status).toBe(400)
    expect(oversized.status).toBe(413)
    expect(mocks.ingestProductSignals).not.toHaveBeenCalled()
  })

  it('refuses a Signal origin this Site never allowed', async () => {
    mocks.ingestProductSignals.mockRejectedValue(new Error('Invalid Product Signal origin'))
    const response = await ingestSignals(
      signalRequest(
        { key: 'secret-key', events: [{ id: 'e1', kind: 'NAVIGATION', name: 'opened', occurredAt: new Date().toISOString() }] },
        { origin: 'https://attacker.example' },
      ),
      signalContext,
    )
    expect(response.status).toBe(403)
  })
})
