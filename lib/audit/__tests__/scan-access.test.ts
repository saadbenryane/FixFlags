import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'vitest'
import {
  encryptScanAccess,
  decryptScanAccess,
  isKnownPreviewTunnelHost,
  parseScanAccessInput,
  scanAccessToFetchHeaders,
  scanAccessToPlaywrightContext,
} from '@/lib/audit/scan-access'

describe('scan-access', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64)
  })

  it('round-trips encrypted scan access', () => {
    const config = {
      httpBasic: { username: 'preview', password: 'secret' },
      cookies: [{ name: 'session', value: 'abc123' }],
      label: 'Staging handoff',
    }
    const encrypted = encryptScanAccess(config)
    assert.equal(decryptScanAccess(encrypted)?.httpBasic?.username, 'preview')
  })

  it('builds fetch and playwright auth options', () => {
    const config = parseScanAccessInput({
      httpBasic: { username: 'u', password: 'p' },
      headers: { 'X-Preview': '1' },
    })
    assert.ok(config)
    const headers = scanAccessToFetchHeaders(config)
    assert.ok(headers.Authorization?.startsWith('Basic '))
    assert.equal(headers['X-Preview'], '1')
    const pw = scanAccessToPlaywrightContext(config)
    assert.equal(pw.httpCredentials?.username, 'u')
  })

  it('detects known preview tunnel hosts', () => {
    assert.equal(isKnownPreviewTunnelHost('abc.ngrok-free.app'), true)
    assert.equal(isKnownPreviewTunnelHost('fixflags.com'), false)
  })
})
