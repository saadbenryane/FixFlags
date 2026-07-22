import { describe, expect, it } from 'vitest'
import { assembleReportViewModel } from '@/lib/report/report-view-model'

describe('assembleReportViewModel', () => {
  it('normalizes internal screenshot URLs before they reach report components', () => {
    const model = assembleReportViewModel({
      auditId: 'audit-1',
      audit: {
        url: 'https://example.com',
        pageType: null,
        verdict: null,
        score: 80,
        shareStatus: 'good_to_share',
        screenshots: [
          {
            device: 'DESKTOP',
            url: 'http://localhost:3000/api/screenshots/audit-1/desktop?page=p0',
            width: 1280,
            height: 900,
          },
        ],
        rubrics: [],
        rubricRows: [],
        flags: [],
      },
      isLoggedIn: false,
      isOwner: false,
      isAnonymous: true,
      showPrompts: false,
    })

    expect(model.summary.screenshots[0]?.url).toBe(
      '/api/screenshots/audit-1/desktop?page=p0'
    )
  })
})
