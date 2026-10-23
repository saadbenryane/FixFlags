import { describe, expect, it } from 'vitest'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { executionRecovery, categoryExecutionRecovery, recoveryReplacesRecheck, type ExecutionRecovery } from '../execution-recovery'

function nextActionLabel(recovery: ExecutionRecovery | null) {
  if (!recoveryReplacesRecheck(recovery)) return null
  return SITE_ACTION_COPY.recovery[recovery.action]
}

describe('server execution recovery decisions', () => {
  it('offers retry for exhausted transient execution without converting blocked setup into retry', () => {
    expect(executionRecovery([{ kind: 'browser', state: 'EXHAUSTED', reason: 'TASK_INTERRUPTED' }])).toMatchObject({ action: 'retry' })
    expect(executionRecovery([{ kind: 'flow', state: 'BLOCKED', reason: 'PROTECTED_ACTION_REQUIRES_FIXTURE' }])).toMatchObject({ action: 'access' })
    expect(executionRecovery([{ kind: 'search', state: 'BLOCKED', reason: 'HTML_BODY_LIMIT' }])).toMatchObject({ action: 'inspect' })
    expect(executionRecovery([{ kind: 'captures', state: 'BLOCKED', reason: 'STORAGE_NOT_CONFIGURED' }])).toMatchObject({ action: 'support' })
  })
  it('preserves unrelated category actions and does not mark not-applicable tasks as missing', () => {
    expect(categoryExecutionRecovery([{ kind: 'flow', state: 'BLOCKED', reason: 'PROTECTED_ACTION_REQUIRES_FIXTURE' },
      { kind: 'pagespeed', state: 'EXHAUSTED', reason: 'PROVIDER_QUOTA' },
      { kind: 'keyboard', state: 'NOT_APPLICABLE', reason: null }])).toEqual({
      conversion: { action: 'access', reasons: ['PROTECTED_ACTION_REQUIRES_FIXTURE'] },
      performance: { action: 'retry', reasons: ['PROVIDER_QUOTA'] },
    })
  })
  it('keeps Recheck available when the only block is a refused public action', () => {
    const retry = executionRecovery([{ kind: 'browser', state: 'EXHAUSTED', reason: 'TASK_INTERRUPTED' }])
    const fixture = executionRecovery([{ kind: 'flow', state: 'BLOCKED', reason: 'PROTECTED_ACTION_REQUIRES_FIXTURE' }])
    const access = executionRecovery([{ kind: 'browser', state: 'BLOCKED', reason: 'PAGE_AUTH_REQUIRED' }])
    const connections = executionRecovery([{ kind: 'google', state: 'BLOCKED', reason: 'GOOGLE_NOT_CONNECTED' }])
    const support = executionRecovery([{ kind: 'captures', state: 'BLOCKED', reason: 'STORAGE_NOT_CONFIGURED' }])
    const inspect = executionRecovery([{ kind: 'search', state: 'BLOCKED', reason: 'HTML_BODY_LIMIT' }])
    expect(nextActionLabel(retry)).toBeNull()
    expect(nextActionLabel(fixture)).toBeNull()
    expect(nextActionLabel(null)).toBeNull()
    expect(nextActionLabel(access)).toBe(SITE_ACTION_COPY.recovery.access)
    expect(nextActionLabel(connections)).toBe(SITE_ACTION_COPY.recovery.connections)
    expect(nextActionLabel(support)).toBe(SITE_ACTION_COPY.recovery.support)
    expect(nextActionLabel(inspect)).toBe(SITE_ACTION_COPY.recovery.inspect)
    expect(recoveryReplacesRecheck(access)).toBe(true)
  })
})
