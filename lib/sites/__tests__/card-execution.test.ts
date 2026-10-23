import { describe, expect, it } from 'vitest'
import { cardExecution } from '../card-execution'
import type { ExecutionProgress } from '../application/execution-progress'

const progress = (kind: string, state: string, module?: string): ExecutionProgress => ({
  total: 1, completed: 0, running: 1, pending: 0, recovering: 0, unknown: 0, inapplicable: 0,
  recoveryUntil: null, eventCursor: null,
  tasks: [{ id: 'one', kind, state, module, pageUrl: 'https://example.com', attempts: 1, reason: null, retryAt: null }],
})

describe('Card execution activity', () => {
  it('attributes active checks by their registered module', () => {
    expect(cardExecution('security', progress('check', 'RUNNING', 'security-headers'))?.detail).toBe('Response protections')
    expect(cardExecution('conversion', progress('check', 'RUNNING', 'conversion-friction'))?.status).toBe('Running')
    expect(cardExecution('search', progress('google', 'RUNNING', 'google-index'))?.status).toBe('Running')
    expect(cardExecution('performance', progress('pagespeed', 'RUNNING'))?.status).toBe('Running')
  })
  it('distinguishes automatic recovery from running work', () => {
    expect(cardExecution('conversion', progress('flow', 'RETRY_WAIT'))?.status).toBe('Retrying')
  })
  it('shows waiting tasks without inventing completed or missing work', () => {
    expect(cardExecution('conversion', progress('flow', 'WAITING'))?.status).toBe('Waiting')
    expect(cardExecution('conversion', progress('flow', 'COMPLETED'))).toBeNull()
    expect(cardExecution('search', progress('flow', 'RUNNING'))).toBeNull()
    expect(cardExecution('site', progress('finalize', 'RUNNING'))).toBeNull()
    expect(cardExecution('conversion', null)).toBeNull()
  })
})
