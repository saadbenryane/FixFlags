import { NextRequest } from 'next/server'
import { afterEach, expect, it, vi } from 'vitest'
import { proxy } from '@/proxy'

afterEach(() => vi.unstubAllEnvs())

it('permits Google Analytics collection in production without enabling eval', async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags.com')
  const response = await proxy(new NextRequest('https://fixflags.com/'))
  const csp = response.headers.get('Content-Security-Policy')!
  const connect = csp.split('; ').find((directive) => directive.startsWith('connect-src'))!
  for (const origin of ['https://www.googletagmanager.com', 'https://*.google-analytics.com', 'https://*.google.com']) {
    expect(connect.split(' ')).toContain(origin)
  }
  expect(csp).not.toContain('unsafe-eval')
})
