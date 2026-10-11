import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import { ensureDefaultMonitoring } from '../default-monitoring'

const now = new Date('2026-10-11T10:00:00Z')
const project = { id: 'site', url: 'http://example.com:8080', watchInterval: null, watchNextRunAt: null,
  watchEveryMinutes: null, watchLastAttemptAt: null, watchLastRunAt: null, watchLastError: null,
  user: { role: 'user', plan: 'FREE', subscriptionStatus: 'NONE' } }
const tx = { project: { findFirst: vi.fn(), updateMany: vi.fn() }, siteOutcome: { upsert: vi.fn() } }

beforeEach(() => {
  vi.clearAllMocks()
  tx.project.findFirst.mockResolvedValue(project)
  tx.project.updateMany.mockResolvedValue({ count: 1 })
})
const ensure = () => ensureDefaultMonitoring(tx as unknown as Prisma.TransactionClient, 'site', 'owner', now)

describe('automatic public monitoring defaults', () => {
  it('creates an executable default in the Site transaction, retains its actual origin and schedules the first check now', async () => {
    expect(await ensure()).toBe(true)
    expect(tx.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'site', userId: 'owner', deletedAt: null } }))
    expect(tx.siteOutcome.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_slug: { projectId: 'site', slug: 'page-loads' } }, update: {},
      create: expect.objectContaining({ kind: 'AVAILABILITY', inferenceSource: 'automatic', confirmedAt: now,
        bindings: { create: { key: 'page-availability-v1', mechanism: 'HTTP_AVAILABILITY', required: true,
          config: { startUrl: 'http://example.com:8080', expectedSelector: 'body' } } } }),
    }))
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'WEEKLY', watchNextRunAt: now } }))
  })

  it('uses the paid cadence without changing subscriptions or exceeding the available policy', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, plan: 'PRO', subscriptionStatus: 'ACTIVE' } })
    await ensure()
    expect(tx.project.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { watchInterval: 'DAILY', watchNextRunAt: now } }))
    tx.project.findFirst.mockResolvedValue({ ...project, user: { ...project.user, plan: 'PRO', subscriptionStatus: 'PAST_DUE' } })
    await ensure()
    expect(tx.project.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: { watchInterval: 'WEEKLY', watchNextRunAt: now } }))
  })

  it('keeps an existing cadence, next check, lease and Outcome intact while adding missing default coverage', async () => {
    tx.project.findFirst.mockResolvedValue({ ...project, watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now })
    await ensure()
    expect(tx.siteOutcome.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {},
      create: expect.objectContaining({ staleAfterMinutes: 900 }) }))
    expect(tx.project.updateMany).not.toHaveBeenCalled()
  })

  it.each([{ watchLastError: 'Paused. This Site is not on a check schedule.' }, { watchLastRunAt: now }, { watchLastAttemptAt: now }])('honors previous monitoring control %j', async history => {
    tx.project.findFirst.mockResolvedValue({ ...project, ...history })
    expect(await ensure()).toBe(false)
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled()
    expect(tx.project.updateMany).not.toHaveBeenCalled()
  })

  it('does not initialize a missing, deleted or foreign Site', async () => {
    tx.project.findFirst.mockResolvedValue(null)
    expect(await ensure()).toBe(false)
    expect(tx.siteOutcome.upsert).not.toHaveBeenCalled()
  })
})
