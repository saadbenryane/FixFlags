import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { MARKETING_LINKS, ADMIN_NAV } from '@/lib/site/nav'

describe('marketing nav labels', () => {
  it('changelog nav points to changelog route', () => {
    const changelog = MARKETING_LINKS.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })
})

describe('ADMIN_NAV', () => {
  it('includes Inbox and Leads', () => {
    const labels = ADMIN_NAV.map((link) => link.label)
    assert.ok(labels.includes('Inbox'))
    assert.ok(labels.includes('Leads'))
    assert.equal(ADMIN_NAV.find((l) => l.label === 'Inbox')?.href, '/admin/inbox')
    assert.equal(ADMIN_NAV.find((l) => l.label === 'Leads')?.href, '/admin/leads')
  })
})
