import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isNavActive } from '@/lib/site/nav-active'

describe('isNavActive', () => {
  it('matches exact routes for dashboard and admin root', () => {
    assert.equal(isNavActive('/dashboard', '/dashboard'), true)
    assert.equal(isNavActive('/dashboard/settings', '/dashboard'), false)
    assert.equal(isNavActive('/admin', '/admin'), true)
    assert.equal(isNavActive('/admin/users', '/admin'), false)
  })

  it('matches settings exactly, not nested app routes', () => {
    assert.equal(isNavActive('/settings', '/settings'), true)
    assert.equal(isNavActive('/settings/api-keys', '/settings'), false)
    assert.equal(isNavActive('/settings/api-keys', '/settings/api-keys'), true)
  })

  it('prefix-matches marketing and nested routes', () => {
    assert.equal(isNavActive('/examples', '/examples'), true)
    assert.equal(isNavActive('/examples/foo', '/examples'), true)
    assert.equal(isNavActive('/pricing', '/examples'), false)
  })

  it('prefix-matches admin inbox and lead detail routes', () => {
    assert.equal(isNavActive('/admin/inbox', '/admin/inbox'), true)
    assert.equal(isNavActive('/admin/leads', '/admin/leads'), true)
    assert.equal(isNavActive('/admin/leads/example.com', '/admin/leads'), true)
    assert.equal(isNavActive('/admin/users', '/admin/leads'), false)
  })
})
