import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const create = vi.hoisted(() => vi.fn())
const send = vi.hoisted(() => vi.fn())
const recordRateLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    demoRequest: { create },
  },
}))
vi.mock('@/lib/email/client', () => ({
  resend: { emails: { send } },
}))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: (...args: unknown[]) => recordRateLimit(...args),
  requestClientId: () => 'test-client',
}))

import { POST } from '../route'

const validBody = {
  name: 'Saad',
  email: 'founder@example.com',
  website: 'example.com',
  plan: 'BUILDER',
}

describe('POST /api/demo-request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('DEMO_NOTIFY_EMAIL', 'notify@example.com')
    vi.stubEnv('RESEND_FROM_EMAIL', 'FixFlags <hello@fixflags.com>')
    recordRateLimit.mockResolvedValue({ exceeded: false })
    create.mockResolvedValue({ id: 'demo-1' })
    send.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  it('rejects invalid email', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/demo-request', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, email: 'not-an-email' }),
      })
    )
    expect(response.status).toBe(400)
    expect(create).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('returns success without persisting when the honeypot is filled', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/demo-request', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, company: 'Bot Co' }),
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(create).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('persists the request and emails notify plus confirmation', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/demo-request', {
        method: 'POST',
        body: JSON.stringify({
          ...validBody,
          plan: 'TEAM',
          siteCount: 8,
          note: 'Agency roster',
        }),
      })
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, emailed: true })
    expect(create).toHaveBeenCalledWith({
      data: {
        name: 'Saad',
        email: 'founder@example.com',
        website: 'https://example.com/',
        plan: 'TEAM',
        siteCount: 8,
        note: 'Agency roster',
      },
    })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'notify@example.com',
        subject: expect.stringContaining('Studio'),
      })
    )
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'founder@example.com',
        from: 'FixFlags <hello@fixflags.com>',
      })
    )
  })

  it('does not start Stripe checkout', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(process.cwd(), 'app/api/demo-request/route.ts'), 'utf8')
    expect(source).not.toMatch(/stripe/i)
    expect(source).not.toMatch(/checkout/i)
  })
})
