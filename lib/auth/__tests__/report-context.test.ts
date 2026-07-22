import { describe, expect, it } from 'vitest'
import { reportIdFromNextPath } from '@/lib/auth/report-context'

describe('reportIdFromNextPath', () => {
  it('extracts only focused report destinations', () => {
    expect(reportIdFromNextPath('/report/report-1')).toBe('report-1')
    expect(reportIdFromNextPath('/report/report-1/details')).toBeNull()
    expect(reportIdFromNextPath('/dashboard')).toBeNull()
    expect(reportIdFromNextPath(null)).toBeNull()
  })
})
