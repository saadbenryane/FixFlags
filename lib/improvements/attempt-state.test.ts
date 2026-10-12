import { describe, expect, it } from 'vitest'
import { attemptHasActiveVerification } from './attempt-state'

const attempt = { outcome: null, sourceAuditId: 'source', verificationAudit: { projectId: 'site', parentId: 'source', status: 'QUEUED' } }
describe('verification state from admitted work', () => {
  it('does not mark an unadmitted, failed, completed or foreign attempt as checking', () => {
    expect(attemptHasActiveVerification({ outcome: null, sourceAuditId: 'source', verificationAudit: null }, 'site')).toBe(false)
    expect(attemptHasActiveVerification({ ...attempt, verificationAudit: { ...attempt.verificationAudit, status: 'FAILED' } }, 'site')).toBe(false)
    expect(attemptHasActiveVerification({ ...attempt, verificationAudit: { ...attempt.verificationAudit, status: 'COMPLETED' } }, 'site')).toBe(false)
    expect(attemptHasActiveVerification(attempt, 'other-site')).toBe(false)
    expect(attemptHasActiveVerification(attempt, 'site', 'later-source')).toBe(false)
    expect(attemptHasActiveVerification({ ...attempt, outcome: 'IMPROVED' }, 'site')).toBe(false)
  })
  it('records admitted work and interrupted finalization without inventing another scan', () => {
    expect(attemptHasActiveVerification(attempt, 'site', 'source')).toBe(true)
    expect(attemptHasActiveVerification({ ...attempt, verificationAudit: { ...attempt.verificationAudit, status: 'COMPLETED',
      verifierExecutions: [{ workKind: 'finalize', workState: 'RETRY_WAIT' }] } }, 'site')).toBe(true)
  })
})
