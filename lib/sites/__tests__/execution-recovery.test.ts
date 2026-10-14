import { describe, expect, it } from 'vitest'
import { executionRecovery, categoryExecutionRecovery } from '../execution-recovery'

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
})
