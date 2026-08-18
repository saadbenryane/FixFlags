import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  AI_SUMMARY_UNAVAILABLE_VERDICT,
  DETERMINISTIC_SCAN_VERDICT,
  displayVerdict,
  groundedReportVerdict,
  isSystemVerdict,
  resolveReportVerdict,
} from '@/lib/audit/verdict'

describe('verdict helpers', () => {
  it('detects deterministic scan stub', () => {
    assert.equal(isSystemVerdict(DETERMINISTIC_SCAN_VERDICT), true)
    assert.equal(displayVerdict(DETERMINISTIC_SCAN_VERDICT), null)
  })

  it('detects AI summary unavailable stub', () => {
    assert.equal(isSystemVerdict(AI_SUMMARY_UNAVAILABLE_VERDICT), true)
    assert.equal(displayVerdict(AI_SUMMARY_UNAVAILABLE_VERDICT), null)
  })

  it('passes through real AI verdicts', () => {
    const verdict = 'Solid foundation with gaps in mobile hero layout.'
    assert.equal(isSystemVerdict(verdict), false)
    assert.equal(displayVerdict(verdict), verdict)
  })

  it('returns null for empty verdict', () => {
    assert.equal(isSystemVerdict(null), false)
    assert.equal(displayVerdict(null), null)
  })

  it('anchors a contradictory AI verdict to the highest-ranked Flag', () => {
    assert.equal(
      resolveReportVerdict('Messaging is the main issue.', {
        problem: 'The page stays blank on slow 3G',
        whyItMatters: 'Visitors cannot reach the primary action',
      }),
      'Highest priority: The page stays blank on slow 3G. Visitors cannot reach the primary action.'
    )
  })

  it('grounds Highest priority in an Important Message Flag over equally severe SEO', () => {
    assert.equal(
      groundedReportVerdict([
        {
          id: 'seo',
          rubric: 'REACH',
          severity: 'IMPORTANT',
          impactTag: 'SEO',
          checkId: 'description-missing',
          problem: 'Meta description is missing',
          whyItMatters: 'Search snippets stay generic.',
        },
        {
          id: 'headline',
          rubric: 'MESSAGE',
          severity: 'IMPORTANT',
          impactTag: 'CLARITY',
          checkId: 'headline-unclear',
          problem: 'The headline is unclear',
          whyItMatters: 'Visitors cannot tell what the product does.',
        },
      ]),
      'Highest priority: The headline is unclear. Visitors cannot tell what the product does.'
    )
  })

  it('does not preserve unsupported prose even when the verdict names the top Flag', () => {
    assert.equal(
      resolveReportVerdict(
        'The page stays blank on slow 3G. The mobile CTA is also hidden.',
        {
          problem: 'The page stays blank on slow 3G',
          whyItMatters: 'Visitors cannot reach the primary action',
        }
      ),
      'Highest priority: The page stays blank on slow 3G. Visitors cannot reach the primary action.'
    )
  })
})
