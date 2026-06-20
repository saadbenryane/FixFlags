import { describe, it, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'

const ORIGINAL_ENV = { ...process.env }

describe('getWorkerQueuedWarning', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns dev message in development', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'development' }
    assert.equal(getWorkerQueuedWarning(true), AUDIT_PROGRESS.workerQueuedWarningDev)
  })

  it('returns prod worker-missing message when worker is missing', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' }
    assert.equal(getWorkerQueuedWarning(true), AUDIT_PROGRESS.workerQueuedWarningProd)
  })

  it('returns backlog message when worker is present', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' }
    assert.equal(getWorkerQueuedWarning(false), AUDIT_PROGRESS.workerBacklogWarningProd)
  })
})
