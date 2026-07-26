import { describe, expect, it, vi } from 'vitest'

const getCliReleaseAvailability = vi.hoisted(() => vi.fn())
vi.mock('@/lib/cli/release', () => ({ getCliReleaseAvailability }))

import { GET } from '@/app/api/cli/release/route'

describe('GET /api/cli/release', () => {
  it('returns registry-backed release availability', async () => {
    getCliReleaseAvailability.mockResolvedValue({
      packageName: 'fixflags',
      version: '0.2.0-beta.1',
      tag: 'beta',
      available: false,
    })
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      packageName: 'fixflags',
      version: '0.2.0-beta.1',
      tag: 'beta',
      available: false,
    })
  })
})
