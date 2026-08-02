import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { pluralize } from '@/lib/utils/plural'

describe('pluralize', () => {
  it('uses the singular form for one', () => {
    assert.equal(pluralize(1, 'fix'), '1 fix')
    assert.equal(pluralize(1, 'Flag'), '1 Flag')
  })

  it('appends s for zero and many', () => {
    assert.equal(pluralize(0, 'issue'), '0 issues')
    assert.equal(pluralize(3, 'issue'), '3 issues')
    assert.equal(pluralize(100, 'issue'), '100 issues')
  })

  it('honors an explicit plural form', () => {
    assert.equal(pluralize(2, 'page', 'pages'), '2 pages')
    assert.equal(pluralize(1, 'page', 'pages'), '1 page')
  })
})
