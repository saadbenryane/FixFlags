import { describe, expect, it } from 'vitest'
import { parsePublicIssueResearch } from '../public-research'
import { researchFixture } from './fixtures/public-research'
const now = new Date('2026-10-13T00:00:00Z')
describe('public research release validation', () => {
  it('accepts a consistent approved aggregate release', () => {
    expect(parsePublicIssueResearch(researchFixture(), now)).not.toBeNull()
  })
  it.each([
    ['permission reference missing', (d: ReturnType<typeof researchFixture>) => { d.permittedUseRef = '' }],
    ['copy review missing', (d: ReturnType<typeof researchFixture>) => { d.copyReviewRef = '' }],
    ['future review', (d: ReturnType<typeof researchFixture>) => { d.reviewedAt = '2026-10-14T00:00:00Z' }],
    ['reversed window', (d: ReturnType<typeof researchFixture>) => { d.windowStart = '2026-10-02T00:00:00Z' }],
    ['review before observations', (d: ReturnType<typeof researchFixture>) => { d.reviewedAt = '2026-09-29T00:00:00Z' }],
    ['missing limitations', (d: ReturnType<typeof researchFixture>) => { d.limitations = [] }],
    ['small dataset', (d: ReturnType<typeof researchFixture>) => { d.sampleSiteCount = 19 }],
    ['small issue cohort', (d: ReturnType<typeof researchFixture>) => { d.issues[0].siteCount = 19 }],
    ['small framework cell', (d: ReturnType<typeof researchFixture>) => { d.issues[0].topFrameworks[0].siteCount = 19 }],
    ['framework count exceeds issue count', (d: ReturnType<typeof researchFixture>) => { d.issues[0].topFrameworks[0].siteCount = 26 }],
    ['issue count exceeds sample', (d: ReturnType<typeof researchFixture>) => { d.issues[0].siteCount = 101 }],
    ['fewer occurrences than sites', (d: ReturnType<typeof researchFixture>) => { d.issues[0].occurrenceCount = 24 }],
    ['duplicate issue', (d: ReturnType<typeof researchFixture>) => { d.issues.push(d.issues[0]) }],
    ['duplicate framework', (d: ReturnType<typeof researchFixture>) => { d.issues[0].topFrameworks.push(d.issues[0].topFrameworks[0]) }],
    ['unknown check', (d: ReturnType<typeof researchFixture>) => { d.issues[0].checkId = 'customer-invented-check' }],
    ['wrong check version', (d: ReturnType<typeof researchFixture>) => { d.issues[0].checkVersion = 999 }],
    ['markup in public copy', (d: ReturnType<typeof researchFixture>) => { d.issues[0].problemTemplate = '</script><script>private</script>' }],
  ])('rejects %s', (_name, mutate) => {
    const dataset = researchFixture()
    mutate(dataset)
    expect(parsePublicIssueResearch(dataset, now)).toBeNull()
  })
  it('rejects identifiable examples and raw audit metadata', () => {
    const dataset = researchFixture()
    expect(parsePublicIssueResearch({ ...dataset, auditIds: ['customer-audit'] }, now)).toBeNull()
    expect(parsePublicIssueResearch({ ...dataset, issues: [{ ...dataset.issues[0], examples: [{ hostname: 'customer.example' }] }] }, now)).toBeNull()
  })
})
