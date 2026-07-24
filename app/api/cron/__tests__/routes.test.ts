import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const runStuckAuditRecoverySweep = vi.hoisted(() => vi.fn())
const runNurtureSweep = vi.hoisted(() => vi.fn())

vi.mock('@/lib/audit/recover-audit-job', () => ({ runStuckAuditRecoverySweep }))
vi.mock('@/lib/leads/run-nurture', () => ({ runNurtureSweep }))

import { GET as recoverStuck } from '@/app/api/cron/recover-stuck-audits/route'
import { GET as nurture } from '@/app/api/cron/nurture/route'

describe('cron routes', () => {
  const previousSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret-value'
    runStuckAuditRecoverySweep.mockResolvedValue({ recovered: 1 })
    runNurtureSweep.mockResolvedValue({ sent: 2 })
  })

  afterEach(() => {
    process.env.CRON_SECRET = previousSecret
  })

  it('rejects missing or wrong secrets', async () => {
    const missing = await recoverStuck(new NextRequest('http://localhost/api/cron/recover-stuck-audits'))
    expect(missing.status).toBe(401)

    const wrong = await nurture(new NextRequest('http://localhost/api/cron/nurture', {
      headers: { authorization: 'Bearer wrong-secret-value' },
    }))
    expect(wrong.status).toBe(401)
    expect(runStuckAuditRecoverySweep).not.toHaveBeenCalled()
    expect(runNurtureSweep).not.toHaveBeenCalled()
  })

  it('runs recovery and nurture sweeps with a valid bearer secret', async () => {
    const recovery = await recoverStuck(new NextRequest('http://localhost/api/cron/recover-stuck-audits', {
      headers: { authorization: 'Bearer cron-secret-value' },
    }))
    expect(recovery.status).toBe(200)
    expect(await recovery.json()).toEqual({ recovered: 1 })

    const nurtureResponse = await nurture(new NextRequest('http://localhost/api/cron/nurture', {
      headers: { authorization: 'Bearer cron-secret-value' },
    }))
    expect(nurtureResponse.status).toBe(200)
    expect(await nurtureResponse.json()).toEqual({ sent: 2 })
  })
})
