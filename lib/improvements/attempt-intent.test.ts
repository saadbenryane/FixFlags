import { expect, it } from 'vitest'
import { attemptIntentHash, assertAttemptReplay, ImprovementAttemptConflict } from './attempt-intent'

const input = { userId: 'owner', sourceAuditId: 'source', handoffReference: 'flag:original', changeSummary: 'Changed the handler',
  commitReference: 'commit-one', deploymentReference: 'deploy-one' }
it('normalizes declared repair fields while preserving source, ownership and reference identity', () => {
  expect(attemptIntentHash({ ...input, changeSummary: ' Changed the handler ' })).toBe(attemptIntentHash(input))
  for (const modified of [{ ...input, userId: 'other' }, { ...input, sourceAuditId: 'other' }, { ...input, commitReference: 'commit-two' },
    { ...input, deploymentReference: 'deploy-two' }, { ...input, changeSummary: 'Changed another handler' }]) {
    expect(() => assertAttemptReplay(modified, { requestHash: attemptIntentHash(input) })).toThrow(ImprovementAttemptConflict)
  }
  expect(() => assertAttemptReplay(input, { requestHash: attemptIntentHash(input) })).not.toThrow()
  expect(() => assertAttemptReplay(input, { requestHash: null })).not.toThrow()
})
