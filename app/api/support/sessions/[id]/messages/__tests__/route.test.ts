import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { PATCH } from '../route'
import { SupportError } from '@/lib/live-support/errors'

const mock = vi.hoisted(() => ({ visitor: vi.fn(), session: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/live-support/visitor-token', () => ({ readVisitorToken: mock.visitor }))
vi.mock('@/lib/live-support', () => ({ getSessionForVisitor: mock.session, markReadByVisitor: mock.read,
  listMessages: vi.fn(), sendVisitorMessage: vi.fn(), serializeMessage: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({ recordRateLimit: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mock.visitor.mockResolvedValue('visitor-token')
  mock.session.mockResolvedValue({ id: 'session' })
  mock.read.mockResolvedValue(undefined)
})
function request(body: unknown) {
  return new NextRequest('http://localhost/api/support/sessions/session/messages', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
}
const context = { params: Promise.resolve({ id: 'session' }) }

it('acknowledges the loaded sequence only for the matching visitor session', async () => {
  const response = await PATCH(request({ through: '7' }), context)
  expect(response.status).toBe(200)
  expect(mock.session).toHaveBeenCalledWith('session', 'visitor-token')
  expect(mock.read).toHaveBeenCalledExactlyOnceWith('session', BigInt(7))
})

it.each([{}, { through: 7 }, { through: '-1' }, { through: '2.5' }, { through: '9'.repeat(20) }, { through: '7', extra: true }])
('refuses an absent or invalid read cursor: %j', async body => {
  expect((await PATCH(request(body), context)).status).toBe(400)
  expect(mock.read).not.toHaveBeenCalled()
})

it.each(['missing', 'different'] as const)('does not mark messages read for a %s visitor', async mode => {
  if (mode === 'missing') mock.visitor.mockResolvedValue(null)
  else mock.session.mockResolvedValue(null)
  expect((await PATCH(request({ through: '7' }), context)).status).toBe(mode === 'missing' ? 401 : 404)
  expect(mock.read).not.toHaveBeenCalled()
})

it('preserves a refused future cursor as a client error', async () => {
  mock.read.mockRejectedValue(new SupportError('Invalid read cursor', 'INVALID_CURSOR', 400))
  expect((await PATCH(request({ through: '8' }), context)).status).toBe(400)
})
