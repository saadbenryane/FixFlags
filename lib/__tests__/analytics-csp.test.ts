import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { afterEach, expect, it, vi } from 'vitest'
import { config, proxy } from '@/proxy'

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
  expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
})

it.each([
  '/share/test-token', '/share/test-token/details', '/share/test-token.png',
  '/reset-password?token=fixture-token', '/cli/authorize?user_code=FIXTURE',
  '/sign-in?next=%2Fcli%2Fauthorize%3Fuser_code%3DFIXTURE',
  '/post-login?next=%2Fcli%2Fauthorize%3Fuser_code%3DFIXTURE',
  '/sites/fixture-site/flags/fixture-flag',
  '/report/fixture-report/details',
  '/report/fixture-report.png',
  '/compare/fixture-comparison',
  '/sign-up?next=%2Fsites%2Ffixture-site',
])(
  'covers private URL %s with no-referrer',
  async (pathname) => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags.com')
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: pathname })).toBe(true)
    const response = await proxy(new NextRequest(`https://fixflags.com${pathname}`))
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
  },
)

it.each(['/sign-up?next=%2Fdashboard', '/how-it-works', '/reports-guide'])('keeps the ordinary referral policy for %s', async path => {
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags.com')
  const response = await proxy(new NextRequest(`https://fixflags.com${path}`))
  expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
})
