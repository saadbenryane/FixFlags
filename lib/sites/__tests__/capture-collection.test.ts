import { describe, expect, it } from 'vitest'
import { captureCollectionState } from '../captures'

describe('missing Site capture disposition', () => {
  it('requires actual admitted capture work before promising a pending image', () => {
    expect(captureCollectionState('CHECKING', [])).toBe('not_recorded')
    expect(captureCollectionState('CHECKING', ['RUNNING'])).toBe('pending')
    expect(captureCollectionState('CHECKING', ['RETRY_WAIT'])).toBe('pending')
    expect(captureCollectionState('CHECKING', ['NOT_APPLICABLE'])).toBe('not_recorded')
  })
  it('does not leave absent images pending after completion or interruption', () => {
    expect(captureCollectionState('COMPLETED', ['COMPLETED'])).toBe('not_recorded')
    expect(captureCollectionState('FAILED', ['WAITING'])).toBe('not_recorded')
    expect(captureCollectionState('CHECKING', ['EXHAUSTED'])).toBe('unavailable')
    expect(captureCollectionState('FAILED', ['CANCELLED'])).toBe('unavailable')
  })
})
