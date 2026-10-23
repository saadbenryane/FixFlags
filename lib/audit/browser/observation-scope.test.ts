import { describe, expect, it } from 'vitest'
import type { Page } from 'playwright'
import { auditPageObservation, bindAuditPageObservation } from './observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from './capture-profile'

function page(): Page {
  return { url: () => 'https://example.com/', viewportSize: () => ({ width: 1280, height: 800 }) } as Page
}

describe('audit page observation restrictions', () => {
  it('keeps a captured page usable when the only restriction is a refused action', () => {
    const captured = page()
    bindAuditPageObservation(captured, 'https://example.com/', DESKTOP_CAPTURE_PROFILE, null, [
      'protected_action_requires_fixture', 'payment_or_download_blocked', 'auxiliary_document_unavailable',
    ])
    expect(auditPageObservation(captured)?.restricted).toBe(false)
  })

  it('marks the page restricted when a request the document depended on was not collected', () => {
    const captured = page()
    bindAuditPageObservation(captured, 'https://example.com/', DESKTOP_CAPTURE_PROFILE, null, [
      'protected_action_requires_fixture', 'read_only_refusal',
    ])
    expect(auditPageObservation(captured)?.restricted).toBe(true)
  })
})
