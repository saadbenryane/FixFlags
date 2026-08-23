import { describe, expect, it } from 'vitest'
import { resolveReportPromptProjection } from '@/lib/report/prompt-access'

describe('report prompt access', () => {
  it('exposes one demonstrated prompt only for curated samples', () => {
    expect(resolveReportPromptProjection('curated-sample')).toEqual({
      explorer: 'one',
      workspace: 'demonstrated',
    })
  })

  it('unlocks the demonstrated top prompt in a live anonymous report', () => {
    expect(resolveReportPromptProjection('live-anonymous')).toEqual({
      explorer: 'one',
      workspace: 'demonstrated',
    })
  })

  it('exposes eligible prompts to the authenticated owner', () => {
    expect(resolveReportPromptProjection('owner')).toEqual({
      explorer: 'all',
      workspace: 'all',
    })
  })
})
