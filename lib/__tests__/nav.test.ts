import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MARKETING_LINKS } from '@/lib/site/nav'

describe('marketing nav labels', () => {
  it('changelog nav points to changelog route', () => {
    const changelog = MARKETING_LINKS.find((link) => link.label === 'Changelog')
    assert.ok(changelog)
    assert.equal(changelog.href, '/changelog')
  })
})
