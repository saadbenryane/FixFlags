import { afterEach, expect, it, vi } from 'vitest'

const { api, handler, initialize } = vi.hoisted(() => {
  const api = { getSession: vi.fn() }
  const handler = vi.fn(async () => new Response(null, { status: 204 }))
  return { api, handler, initialize: vi.fn(() => ({ api, handler })) }
})

vi.mock('better-auth', () => ({ betterAuth: initialize }))
vi.mock('@/lib/analytics/signup-conversion', () => ({ recordSignupConversion: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

it('initializes auth once on first use with the runtime configuration', async () => {
  vi.stubEnv('BETTER_AUTH_SECRET', undefined)
  vi.stubEnv('BETTER_AUTH_URL', 'http://127.0.0.1:3000')
  const { auth } = await import('@/lib/auth')
  expect(initialize).not.toHaveBeenCalled()

  const runtimeSecret = 'local-auth-runtime-initialization-fixture'
  const runtimeOrigin = 'http://127.0.0.1:4567'
  vi.stubEnv('BETTER_AUTH_SECRET', runtimeSecret)
  vi.stubEnv('BETTER_AUTH_URL', runtimeOrigin)
  const request = new Request(runtimeOrigin + '/api/auth/get-session')
  expect((await auth.handler(request)).status).toBe(204)
  expect(handler).toHaveBeenCalledWith(request)
  expect(auth.api).toBe(api)
  expect(initialize).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ secret: runtimeSecret, baseURL: runtimeOrigin }))
})
