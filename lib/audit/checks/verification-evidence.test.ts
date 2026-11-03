import { describe, expect, it } from 'vitest'
import { verificationContexts } from './verification-evidence'
import { SLOW_REPLAY_PROFILE } from '../flow/slow-replay-contract'

describe('repair evidence candidate scopes', () => {
  it('keeps exact and control scopes, slow capture identity, and comparable console horizons', () => {
    const captureKey = 'a'.repeat(64)
    const slow = JSON.stringify({ profile: SLOW_REPLAY_PROFILE, pageUrl: 'https://example.com/', href: null, captureKey })
    const window = 'console:page_load:desktop:public:page:profile:final:window:4000'
    expect(verificationContexts([[{ context: 'original' }, { context: 'original' }, { context: slow }, { context: window }],
      null, [{ selector: '#no-context' }, { context: 5 }, null]])).toEqual({
      exact: ['original', slow, 'slow-replay:v2:' + captureKey, window],
      consoleWindows: ['console:page_load:desktop:public:page:profile:final'],
    })
  })
})
