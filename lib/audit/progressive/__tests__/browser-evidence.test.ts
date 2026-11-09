import { describe, expect, it } from 'vitest'
import type { AuditExecutionTask } from '@prisma/client'
import { hasRecordedDesktopCollection, readBrowserEvidence } from '../browser-evidence'
import { serializeArtifact } from '../contracts'

const window = (complete: boolean, errors = 0) => ({ complete, finalUrl: complete ? 'https://example.com/' : null,
  profile: 'recorded-profile', errors, observedMs: complete ? 2000 : 0, minimumMs: 2000 })
function task(device: 'desktop' | 'mobile', state = 'COMPLETED', pageId = 'page'): AuditExecutionTask {
  return { workKind: 'browser', workState: state, workInput: { device }, workResult: serializeArtifact('browser', {
    pageId, metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopBase64: null, mobileBase64: null,
      desktopHtml: device === 'desktop' ? '<title>Observed desktop</title>' : null,
      consoleErrors: [{ type: 'error', text: 'Controlled repeated error', identity: 'a'.repeat(64) }],
      consoleCoverage: { phase: 'page_load', pageUrl: 'https://example.com/', access: 'public',
        desktop: window(device === 'desktop', 1), mobile: window(device === 'mobile', 1) },
      captureStatus: { desktop: 'pending', mobile: 'pending' }, captureFailures: [],
      desktopLoadExperience: device === 'desktop' ? { device: 'desktop' } : null,
      captureMetrics: device === 'mobile' ? { mobileViewportHeight: 812, desktopLoadExperience: null } : null,
    },
  }) } as unknown as AuditExecutionTask
}

describe('independent browser observation assembly', () => {
  it('does not use an earlier HTTP response to qualify a replacement document at the same URL', () => {
    const pageUrl = 'https://example.com/'
    const observation = { version: 1, device: 'desktop', scope: { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' },
      ready: true, contentVisible: true, restricted: false }
    const snapshot = { desktopHttpStatus: 200, desktopFinalUrl: pageUrl, desktopLoadExperience: { observation } }
    expect(hasRecordedDesktopCollection(snapshot, pageUrl)).toBe(true)
    expect(hasRecordedDesktopCollection({ ...snapshot, desktopLoadExperience: { observation: { ...observation, interrupted: true } } }, pageUrl)).toBe(false)
  })
  it('never renews a joined observation with the later profile timestamp', () => {
    const desktop = task('desktop'), mobile = task('mobile')
    desktop.workResult = { ...desktop.workResult as object, collectedAt: '2026-10-01T12:00:00.000Z' }
    mobile.workResult = { ...mobile.workResult as object, collectedAt: '2026-10-20T12:00:00.000Z' }
    expect(readBrowserEvidence([desktop, mobile])?.collectedAt).toBe('2026-10-01T12:00:00.000Z')
    expect(readBrowserEvidence([mobile, desktop])?.collectedAt).toBe('2026-10-01T12:00:00.000Z')
    expect(readBrowserEvidence([mobile])?.collectedAt).toBe('2026-10-20T12:00:00.000Z')
  })
  it('retains desktop observations while mobile is pending or unavailable', () => {
    for (const state of ['RUNNING', 'EXHAUSTED', 'BLOCKED']) {
      const observed = readBrowserEvidence([task('desktop'), task('mobile', state)])!
      expect(observed.data.snapshot.desktopHtml).toContain('Observed desktop')
      expect(observed.data.snapshot.consoleCoverage?.desktop.complete).toBe(true)
      expect(observed.data.snapshot.consoleCoverage?.mobile.complete).toBe(false)
      expect(observed.data.snapshot.captureMetrics).toBeNull()
    }
  })
  it('keeps mobile facts when desktop collection is unavailable without inventing a document', () => {
    const observed = readBrowserEvidence([task('desktop', 'BLOCKED'), task('mobile')])!
    expect(observed.data.metadata).toBeNull()
    expect(observed.data.snapshot.desktopHtml).toBeNull()
    expect(observed.data.snapshot.captureMetrics?.mobileViewportHeight).toBe(812)
    expect(observed.data.snapshot.consoleCoverage?.desktop.complete).toBe(false)
  })
  it('joins profile-owned windows and deduplicates shared error identities independently of arrival order', () => {
    for (const sources of [[task('desktop'), task('mobile')], [task('mobile'), task('desktop')]]) {
      const observed = readBrowserEvidence(sources)!
      expect(observed.data.snapshot.consoleErrors).toHaveLength(1)
      expect(observed.data.snapshot.consoleCoverage).toMatchObject({ desktop: { complete: true }, mobile: { complete: true } })
      expect(observed.data.snapshot.captureMetrics).toMatchObject({ mobileViewportHeight: 812, desktopLoadExperience: { device: 'desktop' } })
      expect(observed.data.snapshot.desktopHtml).toContain('Observed desktop')
    }
  })
  it('refuses to join independent observations from different pages', () => {
    expect(() => readBrowserEvidence([task('desktop'), task('mobile', 'COMPLETED', 'another-page')]))
      .toThrow('BROWSER_SCOPE_MISMATCH')
  })
})
