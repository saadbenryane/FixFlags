import { describe, expect, it } from 'vitest'
import { siteCaptureAvailability } from '../captures'

describe('capture availability from collection facts', () => {
  it('does not promise a pending screenshot without an unfinished primary media task', () => {
    expect(siteCaptureAvailability([], null)).toEqual({ desktop: 'not_recorded', mobile: 'not_recorded' })
    expect(siteCaptureAvailability([], { url: 'https://example.com', verifierExecutions: [
      { targetKey: 'task:p1:captures', pageUrl: 'https://example.com/contact', workKind: 'captures', workState: 'RUNNING', status: 'RUNNING' },
    ] })).toEqual({ desktop: 'not_recorded', mobile: 'not_recorded' })
  })
  it('keeps pending, failed and terminal unrecorded states distinct', () => {
    const audit = (workState: string, status: string) => ({ url: 'https://example.com', verifierExecutions: [
      { targetKey: 'task:p0:captures', pageUrl: 'https://example.com', workKind: 'captures', workState, status },
    ] })
    expect(siteCaptureAvailability([], audit('RUNNING', 'RUNNING')).desktop).toBe('pending')
    expect(siteCaptureAvailability([], audit('EXHAUSTED', 'INCOMPLETE')).desktop).toBe('unavailable')
    expect(siteCaptureAvailability([], audit('COMPLETED', 'PASSED')).desktop).toBe('not_recorded')
    expect(siteCaptureAvailability([], { ...audit('RUNNING', 'RUNNING'), status: 'COMPLETED' }).desktop).toBe('not_recorded')
    expect(siteCaptureAvailability([], { ...audit('RUNNING', 'RUNNING'), verifierExecutions: audit('RUNNING', 'RUNNING').verifierExecutions.map(task => ({ ...task, workKind: 'browser' })) }).desktop).toBe('not_recorded')
  })
})
