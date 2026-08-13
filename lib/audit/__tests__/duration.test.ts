import { describe, expect, it } from 'vitest'
import { durationFromTimestamps } from '@/lib/audit/duration'

describe('durationFromTimestamps', () => {
  it('returns durationMs in seconds when provided', () => {
    expect(durationFromTimestamps(5000)).toBe(5)
    expect(durationFromTimestamps(1234)).toBe(1)
    expect(durationFromTimestamps(0)).toBe(0)
  })

  it('returns null when durationMs is null', () => {
    expect(durationFromTimestamps(null)).toBeNull()
  })

  it('returns null when durationMs is undefined', () => {
    expect(durationFromTimestamps(undefined)).toBeNull()
  })

  it('calculates from startedAt and completedAt when durationMs not provided', () => {
    const startedAt = '2024-01-01T00:00:00.000Z'
    const completedAt = '2024-01-01T00:00:10.000Z'
    expect(durationFromTimestamps(null, startedAt, completedAt)).toBe(10)
  })

  it('calculates from Date objects', () => {
    const startedAt = new Date('2024-01-01T00:00:00.000Z')
    const completedAt = new Date('2024-01-01T00:00:15.500Z')
    expect(durationFromTimestamps(null, startedAt, completedAt)).toBe(16)
  })

  it('rounds to nearest second', () => {
    const startedAt = '2024-01-01T00:00:00.000Z'
    const completedAt = '2024-01-01T00:00:10.400Z'
    expect(durationFromTimestamps(null, startedAt, completedAt)).toBe(10)
  })

  it('rounds up at 0.5 seconds', () => {
    const startedAt = '2024-01-01T00:00:00.000Z'
    const completedAt = '2024-01-01T00:00:10.600Z'
    expect(durationFromTimestamps(null, startedAt, completedAt)).toBe(11)
  })

  it('returns null when startedAt is missing', () => {
    expect(durationFromTimestamps(null, null, '2024-01-01T00:00:10.000Z')).toBeNull()
    expect(durationFromTimestamps(null, undefined, '2024-01-01T00:00:10.000Z')).toBeNull()
  })

  it('returns null when completedAt is missing', () => {
    expect(durationFromTimestamps(null, '2024-01-01T00:00:00.000Z', null)).toBeNull()
    expect(durationFromTimestamps(null, '2024-01-01T00:00:00.000Z', undefined)).toBeNull()
  })

  it('returns null when both timestamps missing', () => {
    expect(durationFromTimestamps(null, null, null)).toBeNull()
  })

  it('prefers durationMs over timestamps', () => {
    const startedAt = '2024-01-01T00:00:00.000Z'
    const completedAt = '2024-01-01T00:00:10.000Z'
    expect(durationFromTimestamps(5000, startedAt, completedAt)).toBe(5)
  })

  it('handles negative duration (completed before started)', () => {
    const startedAt = '2024-01-01T00:00:10.000Z'
    const completedAt = '2024-01-01T00:00:00.000Z'
    expect(durationFromTimestamps(null, startedAt, completedAt)).toBe(-10)
  })
})