import { describe, expect, it } from 'vitest'
import { uptimeJobId, uptimeJobSchema } from './queue'
const job = { monitorId: 'monitor_1', version: 1, scheduledAt: '2026-10-12T12:00:00.000Z', attempt: 1 as const }
describe('Uptime queue authority and identities', () => {
  it('rejects arbitrary URLs and invalid execution identities', () => {
    expect(uptimeJobSchema.safeParse({ ...job, url: 'http://localhost' }).success).toBe(false)
    expect(uptimeJobSchema.safeParse({ ...job, version: 0 }).success).toBe(false)
    expect(uptimeJobSchema.safeParse({ ...job, attempt: 3 }).success).toBe(false)
    expect(uptimeJobSchema.safeParse({ ...job, scheduledAt: 'invalid' }).success).toBe(false)
  })
  it('deduplicates one schedule slot while separating confirmation and target generations', () => {
    const id = uptimeJobId(job)
    expect(id).toBe(uptimeJobId({ ...job }))
    expect(id).not.toContain(':')
    expect(uptimeJobId({ ...job, version: 2 })).not.toBe(id)
    expect(uptimeJobId({ ...job, attempt: 2 })).not.toBe(id)
    expect(uptimeJobId({ ...job, scheduledAt: '2026-10-12T12:05:00.000Z' })).not.toBe(id)
  })
})
