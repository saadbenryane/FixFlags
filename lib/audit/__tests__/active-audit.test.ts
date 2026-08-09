// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { getActiveAudit, setActiveAudit } from '@/lib/audit/active-audit'

describe('active audit storage', () => {
  afterEach(() => localStorage.clear())

  it('stores only the opaque report reference and queue state', () => {
    setActiveAudit({ auditId: 'audit-1', queue: { state: 'waiting' } as never })
    const raw = localStorage.getItem('ff:active-check')
    expect(raw).toContain('audit-1')
    expect(raw).not.toContain('https://')
    expect(getActiveAudit()?.auditId).toBe('audit-1')
  })

  it('drops legacy stored URLs while retaining the opaque audit id', () => {
    localStorage.setItem('ff:active-check', JSON.stringify({
      auditId: 'audit-1', url: 'https://private.example/path',
    }))
    expect(getActiveAudit()).toEqual({ auditId: 'audit-1', queue: undefined })
  })
})
