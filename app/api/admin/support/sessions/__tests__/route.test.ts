import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const requireAdmin = vi.hoisted(() => vi.fn())
const isAdminResponse = vi.hoisted(() => vi.fn())
const listAdminSessions = vi.hoisted(() => vi.fn())
const serializeSession = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/require-admin', () => ({ requireAdmin, isAdminResponse }))
vi.mock('@/lib/live-support', () => ({ listAdminSessions, serializeSession }))

import { GET } from '@/app/api/admin/support/sessions/route'

describe('GET /api/admin/support/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAdmin.mockResolvedValue({ id: 'admin-1' })
    isAdminResponse.mockReturnValue(false)
    serializeSession.mockImplementation((session) => ({ id: session.id, status: session.status }))
    listAdminSessions.mockResolvedValue([
      {
        id: 'session-1',
        status: 'open',
        lead: null,
        user: { id: 'user-1' },
        project: null,
      },
    ])
  })

  it('returns unauthorized admin responses unchanged', async () => {
    const denied = NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    requireAdmin.mockResolvedValue(denied)
    isAdminResponse.mockReturnValue(true)
    const response = await GET(new NextRequest('http://localhost/api/admin/support/sessions'))
    expect(response.status).toBe(403)
    expect(listAdminSessions).not.toHaveBeenCalled()
  })

  it('lists open sessions for admins and honors filter', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/support/sessions?filter=closed')
    )
    expect(response.status).toBe(200)
    expect(listAdminSessions).toHaveBeenCalledWith('closed')
    expect(await response.json()).toEqual({
      sessions: [
        {
          id: 'session-1',
          status: 'open',
          lead: null,
          user: { id: 'user-1' },
          project: null,
        },
      ],
    })
  })
})
