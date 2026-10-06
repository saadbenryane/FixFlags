import { describe, expect, it } from 'vitest'
import {
  developerKeyExpiresAt,
  developerKeyExpiryDays,
  developerKeyPreset,
  developerKeyScopeLabel,
} from '@/lib/mcp/developer-key-policy'

describe('developer key policy', () => {
  it('defaults to read-only access and a 90-day lifetime', () => {
    expect(developerKeyPreset(undefined)?.id).toBe('read_only')
    expect(developerKeyExpiryDays(undefined)).toBe(90)
    expect(developerKeyExpiresAt(90, new Date('2026-10-05T00:00:00.000Z')).toISOString()).toBe(
      '2027-01-03T00:00:00.000Z'
    )
  })

  it('refuses unknown access and lifetime values', () => {
    expect(developerKeyPreset('root')).toBeNull()
    expect(developerKeyPreset(1)).toBeNull()
    expect(developerKeyExpiryDays(0)).toBeNull()
    expect(developerKeyExpiryDays('90')).toBeNull()
  })

  it('labels canonical scopes without turning legacy access into a false narrow claim', () => {
    expect(developerKeyScopeLabel(['flags:read', 'sites:read', 'runs:read'])).toBe('Read evidence')
    expect(developerKeyScopeLabel([])).toBe('Legacy full access')
    expect(developerKeyScopeLabel(['sites:read', 'flags:write'])).toBe('Custom access')
  })
})
