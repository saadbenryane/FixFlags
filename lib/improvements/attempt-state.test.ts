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
  it('keeps a legacy single-Flag handoff from making another Flag on the same source look active', () => {
    const scoped = { ...attempt, handoffReference: 'flag:original' }
    expect(attemptHasActiveVerification(scoped, 'site', 'source', 'original')).toBe(true)
    expect(attemptHasActiveVerification(scoped, 'site', 'source', 'unrelated')).toBe(false)
  })
  it('recognizes every frozen grouped capture while retaining execution authority and source scope', () => {
    const grouped = { ...attempt, sourceFlagIds: ['representative', 'earlier-capture'] }
    expect(attemptHasActiveVerification(grouped, 'site', 'earlier-audit', 'earlier-capture')).toBe(true)
    expect(attemptHasActiveVerification(grouped, 'site', 'source', 'later-capture')).toBe(false)
    expect(attemptHasActiveVerification(grouped, 'site', 'earlier-audit')).toBe(false)
    expect(attemptHasActiveVerification(grouped, 'other-site', 'earlier-audit', 'earlier-capture')).toBe(false)
    expect(attemptHasActiveVerification({ ...grouped, verificationAudit: { ...attempt.verificationAudit, parentId: 'wrong-source' } },
      'site', 'earlier-audit', 'earlier-capture')).toBe(false)
    expect(attemptHasActiveVerification({ ...grouped, outcome: 'IMPROVED' }, 'site', 'earlier-audit', 'earlier-capture')).toBe(false)
    expect(attemptHasActiveVerification({ ...grouped, verificationAudit: { ...attempt.verificationAudit, status: 'FAILED' } },
      'site', 'earlier-audit', 'earlier-capture')).toBe(false)
  })
})
