import { describe, expect, it } from 'vitest'
import {
  progressivePayloadFingerprint,
  type AuditStatusPayload,
} from '@/hooks/useAuditPolling'

const base: AuditStatusPayload = {
  status: 'CHECKING',
  progress: 55,
  url: 'https://example.com',
  screenshots: [],
  partialFlags: [],
}

describe('progressivePayloadFingerprint', () => {
  it('changes when progressive evidence changes at the same numeric progress', () => {
    const withScreenshot: AuditStatusPayload = {
      ...base,
      screenshots: [
        {
          device: 'DESKTOP',
          url: '/desktop.png',
          width: 1280,
          height: 900,
        },
      ],
    }
    const withFlag: AuditStatusPayload = {
      ...withScreenshot,
      partialFlags: [
        {
          id: 'flag-1',
          severity: 'CRITICAL',
          problem: 'Primary action is blocked',
          rubric: 'EXPERIENCE',
        },
      ],
    }

    expect(progressivePayloadFingerprint(base)).not.toBe(
      progressivePayloadFingerprint(withScreenshot)
    )
    expect(progressivePayloadFingerprint(withScreenshot)).not.toBe(
      progressivePayloadFingerprint(withFlag)
    )
  })
})
