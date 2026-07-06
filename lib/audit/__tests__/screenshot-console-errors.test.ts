import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { dedupeConsoleErrors } from '@/lib/audit/screenshot'

describe('dedupeConsoleErrors', () => {
  it('collapses the same error fired on both the desktop and mobile capture into one', () => {
    // Regression test: desktop and mobile each navigate their own page but push
    // into one shared consoleErrors array, so an error that fires on every page
    // load landed twice before this fix - inflating trust.ts's console-error
    // count/severity well past the real distinct-error count.
    const errors = [
      { type: 'error', text: 'Uncaught ReferenceError: ga is not defined' },
      { type: 'error', text: 'Uncaught ReferenceError: ga is not defined' },
    ]
    assert.deepEqual(dedupeConsoleErrors(errors), [
      { type: 'error', text: 'Uncaught ReferenceError: ga is not defined' },
    ])
  })

  it('keeps genuinely distinct errors separate', () => {
    const errors = [
      { type: 'error', text: 'Error A' },
      { type: 'error', text: 'Error B' },
      { type: 'error', text: 'Error A' },
    ]
    assert.deepEqual(dedupeConsoleErrors(errors), [
      { type: 'error', text: 'Error A' },
      { type: 'error', text: 'Error B' },
    ])
  })

  it('treats same text with a different type as distinct', () => {
    const errors = [
      { type: 'error', text: 'Something happened' },
      { type: 'warning', text: 'Something happened' },
    ]
    assert.equal(dedupeConsoleErrors(errors).length, 2)
  })

  it('returns an empty array for no errors', () => {
    assert.deepEqual(dedupeConsoleErrors([]), [])
  })
})
