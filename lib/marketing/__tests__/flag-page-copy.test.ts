import { describe, expect, it } from 'vitest'
import { FLAG_PAGE_COPY, flagDeviceLabel } from '@/lib/marketing/copy/flag-page'

describe('Flag page location line', () => {
  it('names the page and the device in plain words, without separators', () => {
    expect(FLAG_PAGE_COPY.where('/pricing', flagDeviceLabel('mobile'))).toBe('/pricing on a phone')
    expect(FLAG_PAGE_COPY.where('/', flagDeviceLabel('desktop'))).toBe('/ on desktop')
    expect(FLAG_PAGE_COPY.where('/cart', flagDeviceLabel('390x844'))).toBe('/cart at 390x844')
    expect(FLAG_PAGE_COPY.where('Search', flagDeviceLabel(null))).toBe('Search')
    expect(JSON.stringify(FLAG_PAGE_COPY)).not.toMatch(/·/)
  })
})
