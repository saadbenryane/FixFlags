import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import {
  buildPostLoginQuery,
  sanitizeFunnelFrom,
  sanitizeNextPath,
} from '@/hooks/useAuthRedirect'

describe('auth redirect helpers', () => {
  it('always routes through /post-login so claim runs before next', () => {
    assert.equal(buildPostLoginQuery(null, null, null), '/post-login')
    assert.equal(
      buildPostLoginQuery('/report/abc', null, 'report'),
      '/post-login?next=%2Freport%2Fabc&from=report'
    )
    assert.ok(buildPostLoginQuery('/dashboard', 'BUILDER', 'pricing').startsWith('/post-login?'))
    assert.ok(!buildPostLoginQuery('/report/abc', null, null).startsWith('/report/'))
  })

  it('rejects open redirects in next', () => {
    assert.equal(sanitizeNextPath('https://evil.example'), null)
    assert.equal(sanitizeNextPath('//evil.example'), null)
    assert.equal(sanitizeNextPath('/report/abc'), '/report/abc')
  })

  it('only keeps known funnel sources', () => {
    assert.equal(sanitizeFunnelFrom('report'), 'report')
    assert.equal(sanitizeFunnelFrom('unknown'), null)
  })
})
