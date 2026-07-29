import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RubricBar } from '@/components/audit/RubricBar'

describe('RubricBar', () => {
  it('links a rubric with Critical Flags to its first Critical Flag', () => {
    render(
      <RubricBar
        rubrics={[
          { name: 'MESSAGE', flagCount: 4, criticalCount: 2 },
          { name: 'EXPERIENCE', flagCount: 1, criticalCount: 0 },
          { name: 'REACH', flagCount: 0, criticalCount: 0 },
        ]}
        firstCriticalIds={{ MESSAGE: 'flag-message-1' }}
      />
    )
    expect(screen.getByText('4 Flags · 2 critical')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Show 2 Critical Flags in Message' })
    ).toHaveAttribute(
      'href',
      '?rubric=MESSAGE&severity=CRITICAL&flag=flag-message-1#report-flags'
    )
  })

  it('links a rubric without Critical Flags to its complete Flag list', () => {
    render(
      <RubricBar
        rubrics={[
          { name: 'MESSAGE', flagCount: 0, criticalCount: 0 },
          { name: 'EXPERIENCE', flagCount: 3, criticalCount: 0 },
          { name: 'REACH', flagCount: 1, criticalCount: 0 },
        ]}
        firstCriticalIds={{}}
      />
    )
    expect(screen.getByText('3 Flags')).toBeInTheDocument()
    expect(screen.getByText('1 Flag')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Show all Experience Flags' })
    ).toHaveAttribute('href', '?rubric=EXPERIENCE#report-flags')
  })
})
