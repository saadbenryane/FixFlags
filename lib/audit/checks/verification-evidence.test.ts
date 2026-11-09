import { describe, expect, it } from 'vitest'
import { verificationContexts } from './verification-evidence'
import { SLOW_REPLAY_PROFILE } from '../flow/slow-replay-contract'
import { KEYBOARD_FOCUS_POLICY } from '../browser/keyboard-probe'

describe('repair evidence candidate scopes', () => {
  it('normalizes comparable page-load requests while retaining historical action scope', () => {
    const suffix = 'a'.repeat(64) + ':capture:' + 'b'.repeat(64) + ':page:' + 'c'.repeat(64)
    const request = ':vercel:library:example.com/_vercel/insights/script.js:request:'
    const page = 'tracking:page_load' + request
    const action = 'tracking:public_action' + request + 'v2:' + suffix
    expect(verificationContexts([[{ context: page + 'v2:' + suffix }, { context: action }]])).toEqual({
      exact: [page + 'v3:' + suffix, action], consoleWindows: [],
    })
  })

  it('loads fresh keyboard hit evidence for a historical painted focus finding', () => {
    const prefix = 'keyboard:' + 'a'.repeat(64) + ':' + 'b'.repeat(64) + ':page_load'
    expect(verificationContexts([[{ context: prefix + ':focus:painted-properties-v3' },
      { context: prefix + ':focus:painted-properties-v4' }, { context: prefix }]])).toEqual({
      exact: [prefix + ':focus:' + KEYBOARD_FOCUS_POLICY, prefix], consoleWindows: [],
    })
  })

  it('loads current CSP evidence for a historical missing-policy target', () => {
    const suffix = 'same-response'
    expect(verificationContexts([[{ context: 'security-header:content-security-policy:' + suffix }]])).toEqual({
      exact: ['security-header:v2:content-security-policy:' + suffix], consoleWindows: [],
    })
  })

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
