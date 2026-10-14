import { describe, expect, it } from 'vitest'
import { summarizeExecutionTasks } from '../execution-summary'

describe('execution settlement summary', () => {
  it('accounts for every terminal task once without describing assertions as passed', () => {
    const summary = summarizeExecutionTasks([
      { status: 'COMPLETED', workState: 'COMPLETED' },
      { status: 'NOT_APPLICABLE', workState: 'COMPLETED' },
      { status: 'FAILED', workState: 'BLOCKED', workErrorCode: 'PROTECTED_ACTION_REQUIRES_FIXTURE' },
      { status: 'FAILED', workState: 'EXHAUSTED', workErrorCode: 'BROWSER_TIMEOUT' },
    ])
    expect(summary).toMatchObject({ total: 4, recorded: 1, notApplicable: 1, limited: 1, failed: 1, pending: 0, state: 'failed' })
    expect(summary.recorded + summary.notApplicable + summary.limited + summary.failed).toBe(summary.total)
    expect(summary).not.toHaveProperty('passed')
  })

  it('does not describe retrying or queued work as finished', () => {
    expect(summarizeExecutionTasks([{ status: 'PENDING', workState: 'RETRY_WAIT' }, { status: 'PENDING', workState: 'READY' }]))
      .toMatchObject({ state: 'active', recovering: 1, pending: 1, recorded: 0 })
  })

  it('preserves unavailable historical state and deduplicates reasons', () => {
    expect(summarizeExecutionTasks([{ status: 'FAILED', workState: null },
      { status: 'FAILED', workState: 'BLOCKED', workErrorCode: 'ACCESS_REQUIRED' },
      { status: 'FAILED', workState: 'BLOCKED', workErrorCode: 'ACCESS_REQUIRED' }]))
      .toMatchObject({ limited: 3, state: 'limited', reasons: ['ACCESS_REQUIRED'] })
  })
})
