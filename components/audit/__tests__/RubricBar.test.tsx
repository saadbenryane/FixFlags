import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RubricBar } from '@/components/audit/RubricBar'
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

describe('RubricBar', () => {
  it('shows critical count when present', () => {
    render(
      <RubricBar
        rubrics={[
          rubric({ name: 'MESSAGE', status: 'BLOCKED', flagCount: 2, criticalCount: 2 }),
          rubric({ name: 'EXPERIENCE' }),
          rubric({ name: 'REACH', status: 'NEEDS_ATTENTION', flagCount: 1, importantCount: 1 }),
        ]}
        rubricRows={[
          { name: 'MESSAGE', score: 40, grade: 'F' },
          { name: 'EXPERIENCE', score: 90, grade: 'A' },
          { name: 'REACH', score: 72, grade: 'C' },
        ]}
      />
    )
    expect(screen.getByText('2 critical')).toBeInTheDocument()
    expect(screen.getByText('1 flag')).toBeInTheDocument()
  })

  it('omits flag counts when a rubric is clean', () => {
    render(
      <RubricBar
        rubrics={[
          rubric({ name: 'MESSAGE' }),
          rubric({ name: 'EXPERIENCE' }),
          rubric({ name: 'REACH' }),
        ]}
        rubricRows={[
          { name: 'MESSAGE', score: 99, grade: 'A' },
          { name: 'EXPERIENCE', score: 95, grade: 'A' },
          { name: 'REACH', score: 88, grade: 'B' },
        ]}
      />
    )
    expect(screen.queryByText(/critical/)).not.toBeInTheDocument()
    expect(screen.queryByText(/flags?/)).not.toBeInTheDocument()
  })
})
