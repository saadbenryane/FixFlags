import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ audit: vi.fn(), event: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findFirst: mocks.audit } } }))
vi.mock('../site-events', () => ({ recordSiteLifecycleEvent: mocks.event }))
import { recordSiteEvidenceRead } from '../site-evidence-read'

const input = { projectId: 'owned-project', userId: 'owner', flagId: 'flag', auditId: 'source' }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-12T12:01:00Z'))
  mocks.audit.mockReset().mockResolvedValue({ createdAt: new Date('2026-11-12T12:00:00Z') })
  mocks.event.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

it('records the first evidence read separately from completion, with an exact source and duration', async () => {
  await recordSiteEvidenceRead(input)
  expect(mocks.audit).toHaveBeenCalledExactlyOnceWith({ where: { id: 'source', projectId: 'owned-project', userId: 'owner' }, select: { createdAt: true } })
  expect(mocks.event).toHaveBeenCalledWith({ name: 'first_evidence_read', idempotencyKey: 'first_evidence_read:source',
    projectId: 'owned-project', userId: 'owner', properties: { auditId: 'source', elapsedMs: 60_000 } })
  expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'flag_opened', idempotencyKey: 'flag_opened:owned-project:flag' }))
  expect(mocks.event.mock.calls.some(([event]) => event.name === 'analysis_completed')).toBe(false)
})

it('does not record an unrelated or missing source scan', async () => {
  mocks.audit.mockResolvedValue(null)
  await recordSiteEvidenceRead(input)
  expect(mocks.event).not.toHaveBeenCalled()
})

it('does not report a negative duration when the source clock is ahead', async () => {
  mocks.audit.mockResolvedValue({ createdAt: new Date('2026-11-12T12:02:00Z') })
  await recordSiteEvidenceRead(input)
  expect(mocks.event).toHaveBeenCalledOnce()
  expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ name: 'flag_opened' }))
})
