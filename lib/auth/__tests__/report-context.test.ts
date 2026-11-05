import { describe, expect, it } from 'vitest'
import { reportIdFromNextPath, siteAuthDestination } from '@/lib/auth/report-context'

describe('reportIdFromNextPath', () => {
  it('extracts only focused report destinations', () => {
    expect(reportIdFromNextPath('/report/report-1')).toBe('report-1')
    expect(reportIdFromNextPath('/report/report-1/details')).toBeNull()
    expect(reportIdFromNextPath('/dashboard')).toBeNull()
    expect(reportIdFromNextPath(null)).toBeNull()
  })
})

describe('Site authentication destinations', () => {
  it.each([
    '/sites/site-1', '/sites/p_provisional?category=conversion&flag=incident#evidence',
    '/sites/site-1/flags/flag-1', '/sites/site-1/settings#watch',
  ])('retains the exact Site destination and identifies its Site: %s', href => {
    expect(siteAuthDestination(href)).toEqual({ kind: 'site', id: href.includes('p_provisional') ? 'p_provisional' : 'site-1', href })
  })
  it('retains focused report compatibility with its query and fragment', () => {
    expect(siteAuthDestination('/report/report-1?view=details#flag')).toEqual({ kind: 'report', id: 'report-1', href: '/report/report-1?view=details#flag' })
    expect(siteAuthDestination('/report/report-1/details')).toBeNull()
  })
  it.each([null, '/dashboard', '//foreign.test/sites/site', 'https://foreign.test/sites/site',
    '/sites/', '/sites/%2Fforeign', '/sites/%5Cforeign', '/sites/site/%5Cforeign', '/sites/%00id', '/sites/bad%ZZ'])('refuses unrelated or malformed context: %s', href => {
    expect(siteAuthDestination(href)).toBeNull()
  })
})
