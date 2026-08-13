import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  keyCreate: vi.fn(),
  keyFindFirst: vi.fn(),
  keyUpdate: vi.fn(),
  keyCount: vi.fn(),
  releaseUpsert: vi.fn(),
  signalCreateMany: vi.fn(),
  signalDeleteMany: vi.fn(),
  canAccessProductWatch: vi.fn(),
}))

vi.mock('@/lib/auth/entitlements', () => ({
  canAccessProductWatch: mocks.canAccessProductWatch,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    productSignalKey: {
      create: mocks.keyCreate,
      findFirst: mocks.keyFindFirst,
      update: mocks.keyUpdate,
      count: mocks.keyCount,
    },
    productRelease: { upsert: mocks.releaseUpsert },
    productSignal: {
      createMany: mocks.signalCreateMany,
      deleteMany: mocks.signalDeleteMany,
    },
  },
}))

import {
  deleteExpiredProductSignals,
  ingestProductSignals,
  issueProductSignalKey,
  normalizeSignalOrigin,
  sanitizeSignalRoute,
} from './product-signals'

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.keyUpdate.mockResolvedValue({})
  mocks.keyCount.mockResolvedValue(0)
  mocks.canAccessProductWatch.mockReturnValue(true)
})

describe('Product Signal privacy boundary', () => {
  it('keeps only an origin and sanitized pathname', () => {
    expect(normalizeSignalOrigin('https://Example.com/path?secret=yes')).toBe(
      'https://example.com'
    )
    expect(
      sanitizeSignalRoute('https://example.com/signup?email=person@example.com#form', 'https://example.com')
    ).toBe('/signup')
    expect(() =>
      sanitizeSignalRoute('https://attacker.example/collect', 'https://example.com')
    ).toThrow('configured origin')
  })

  it('issues an origin-bound key only after a completed Product Review', async () => {
    mocks.projectFindFirst.mockResolvedValue(null)
    await expect(
      issueProductSignalKey({
        projectId: 'product-1',
        userId: 'user-1',
        name: 'Production',
        allowedOrigin: 'https://example.com',
      })
    ).rejects.toThrow('completed Review')
    expect(mocks.keyCreate).not.toHaveBeenCalled()
  })

  it('requires Product Watch entitlement to issue or ingest signals', async () => {
    mocks.canAccessProductWatch.mockReturnValue(false)
    mocks.projectFindFirst.mockResolvedValue({
      id: 'product-1',
      user: { id: 'user-1', role: 'user', plan: 'FREE', subscriptionStatus: 'ACTIVE' },
    })
    await expect(issueProductSignalKey({
      projectId: 'product-1',
      userId: 'user-1',
      name: 'Production',
      allowedOrigin: 'https://example.com',
    })).rejects.toThrow('Product Watch access')

    mocks.keyFindFirst.mockResolvedValue({
      id: 'key-1',
      project: {
        user: { id: 'user-1', role: 'user', plan: 'FREE', subscriptionStatus: 'ACTIVE' },
      },
    })
    await expect(ingestProductSignals({
      projectId: 'product-1',
      origin: 'https://example.com',
      payload: {
        key: 'ff_sig_abcdefghijklmnopqrstuvwxyz',
        events: [{
          id: 'event-12345',
          kind: 'ACTION',
          name: 'signup',
          occurredAt: new Date().toISOString(),
        }],
      },
    })).rejects.toThrow('Product Watch access')
  })

  it('rejects undeclared fields instead of collecting arbitrary content', async () => {
    await expect(
      ingestProductSignals({
        projectId: 'product-1',
        origin: 'https://example.com',
        payload: {
          key: 'ff_sig_abcdefghijklmnopqrstuvwxyz',
          events: [
            {
              id: 'event-12345',
              kind: 'ACTION',
              name: 'signup',
              occurredAt: new Date().toISOString(),
              inputValue: 'must never be accepted',
            },
          ],
        },
      })
    ).rejects.toThrow()
    expect(mocks.keyFindFirst).not.toHaveBeenCalled()
  })

  it('stores bounded observations with hashed sessions, release linkage, and expiry', async () => {
    mocks.keyFindFirst.mockResolvedValue({
      id: 'key-1',
      project: {
        user: { id: 'user-1', role: 'user', plan: 'PRO', subscriptionStatus: 'ACTIVE' },
      },
    })
    mocks.releaseUpsert.mockResolvedValue({ id: 'release-1' })
    mocks.signalCreateMany.mockResolvedValue({ count: 1 })
    const occurredAt = new Date().toISOString()

    const result = await ingestProductSignals({
      projectId: 'product-1',
      origin: 'https://example.com',
      payload: {
        key: 'ff_sig_abcdefghijklmnopqrstuvwxyz',
        events: [
          {
            id: 'event-12345',
            kind: 'OUTCOME',
            name: 'signup:success',
            route: '/signup?email=secret@example.com',
            session: 'anonymous-session-123',
            release: '1.8.0',
            occurredAt,
          },
        ],
      },
    })

    expect(result).toEqual({ accepted: 1, duplicates: 0 })
    const data = mocks.signalCreateMany.mock.calls[0][0].data[0]
    expect(data.route).toBe('/signup')
    expect(data.sessionHash).not.toContain('anonymous-session-123')
    expect(data.releaseId).toBe('release-1')
    expect(data.provenance.truthClass).toBe('OBSERVED')
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('deletes raw signals by expiry without touching derived Improvements', async () => {
    mocks.signalDeleteMany.mockResolvedValue({ count: 7 })
    const now = new Date('2026-08-13T12:00:00.000Z')
    await expect(deleteExpiredProductSignals(now)).resolves.toBe(7)
    expect(mocks.signalDeleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } })
  })
})
