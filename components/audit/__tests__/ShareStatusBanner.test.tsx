import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import { rubricLabel } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'

function rubric(overrides: Partial<RubricComputed> & { name: string }): RubricComputed {
  return {
    status: 'PASS',
    flagCount: 0,
    criticalCount: 0,
    importantCount: 0,
    ...overrides,
  }
}

const CLEAN_RUBRICS = [
  rubric({ name: 'MESSAGE' }),
  rubric({ name: 'EXPERIENCE' }),
  rubric({ name: 'REACH' }),
]

describe('ShareStatusBanner', () => {
  it('celebrates a clean report and shows every rubric badge', () => {
    render(<ShareStatusBanner shareStatus="good_to_share" rubrics={CLEAN_RUBRICS} />)
    expect(screen.getByText('No critical Flags. Good to share.')).toBeInTheDocument()
    for (const r of CLEAN_RUBRICS) {
      expect(screen.getByText(rubricLabel(r.name))).toBeInTheDocument()
    }
  })

  it('shows generic fix message for critical flags', () => {
    const rubrics = [
      rubric({ name: 'MESSAGE', status: 'BLOCKED', flagCount: 1, criticalCount: 1 }),
      rubric({ name: 'EXPERIENCE' }),
      rubric({ name: 'REACH' }),
    ]
    render(<ShareStatusBanner shareStatus="fix_before_sharing" rubrics={rubrics} />)
    expect(screen.getByText('Fix critical Flags before sharing.')).toBeInTheDocument()
  })

  it('shows generic fix message for multiple critical flags', () => {
    const rubrics = [
      rubric({ name: 'MESSAGE', status: 'BLOCKED', flagCount: 2, criticalCount: 2 }),
      rubric({ name: 'EXPERIENCE', status: 'BLOCKED', flagCount: 1, criticalCount: 1 }),
      rubric({ name: 'REACH' }),
    ]
    render(<ShareStatusBanner shareStatus="fix_before_sharing" rubrics={rubrics} />)
    expect(screen.getByText('Fix critical Flags before sharing.')).toBeInTheDocument()
  })
})
