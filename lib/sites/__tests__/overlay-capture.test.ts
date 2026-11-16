import { describe, expect, it } from 'vitest'
import { recordedOverlayCapture } from '../overlay-capture'
import { overlayControlContext, type OverlayObservation } from '@/lib/audit/checks/overlay-evidence'

const scope = { pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', profile: 'mobile-375', access: 'public' }
const context = overlayControlContext(scope, 'nav', 'original-link')
function fixture() {
  const observation: OverlayObservation = { version: 1, device: 'mobile', scope, restricted: false, contentVisible: true, complete: true,
    controls: [{ kind: 'nav', selector: '#original', label: 'Original link', context, disposition: 'failed', reason: 'persistent_overlay',
      blocker: { tag: 'div', id: 'cover', className: 'overlay', role: 'dialog', text: 'Advertisement', zIndex: '100', coverageFraction: 1 } }],
    capture: { url: 'https://fixflags.com/api/screenshots/original-audit/mobile?page=overlay-unique', recordedAt: '2026-11-12T12:00:00.000Z', context } }
  return { auditId: 'original-audit', pageUrl: scope.pageUrl, targets: [{ context, device: 'mobile', source: 'measured' }], artifact: { data: { observation } } }
}
describe('Flag-owned overlay captures', () => {
  it('uses only the exact original observation and returns an authenticated image path', () => {
    expect(recordedOverlayCapture(fixture())).toEqual({ url: '/api/screenshots/original-audit/mobile?page=overlay-unique', recordedAt: '2026-11-12T12:00:00.000Z' })
  })
  it.each(['audit', 'device', 'target', 'page', 'restricted', 'clear', 'missing'] as const)('refuses an image with mismatched or unavailable %s evidence', condition => {
    const input = fixture(), observation = input.artifact.data.observation
    if (condition === 'audit') input.auditId = 'another-audit'
    if (condition === 'device') input.targets[0].device = 'desktop'
    if (condition === 'target') input.targets[0].context = overlayControlContext(scope, 'nav', 'another-link')
    if (condition === 'page') input.pageUrl = 'https://example.com/another'
    if (condition === 'restricted') observation.restricted = true
    if (condition === 'clear') observation.controls[0].disposition = 'passed'
    if (condition === 'missing') delete observation.capture
    expect(recordedOverlayCapture(input)).toBeNull()
  })
})
