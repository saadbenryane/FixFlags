import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlagDetailPane, RubricTabs } from '@/components/report/ReportExplorerDetail'
import { MeProvider } from '@/hooks/useMe'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import type { ReactNode } from 'react'

function renderWithProviders(ui: ReactNode) {
  return render(<MeProvider initialUser={null}>{ui}</MeProvider>)
}

const DISPLAY = buildSampleReportDisplay(getStaticSampleAudit())
const MODEL = buildSampleExplorerModel(DISPLAY, { promptAccess: 'one' })
const FIRST_FLAG = MODEL.flags[0]

describe('RubricTabs', () => {
  it('renders all rubric tabs plus All Flags', () => {
    const onChange = vi.fn()
    render(
      <RubricTabs
        rubricFilter="ALL"
        onRubricChange={onChange}
        counts={{ MESSAGE: 2, EXPERIENCE: 1, REACH: 3 }}
        total={6}
      />
    )
    expect(screen.getByText('All Flags')).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('calls onRubricChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(
      <RubricTabs
        rubricFilter="ALL"
        onRubricChange={onChange}
        counts={{ MESSAGE: 2, EXPERIENCE: 0, REACH: 0 }}
        total={2}
      />
    )
    const messageTab = screen.getByText('Message')
    fireEvent.click(messageTab)
    expect(onChange).toHaveBeenCalledWith('MESSAGE')
  })
})

describe('FlagDetailPane', () => {
  it('renders flag title and meta pills', () => {
    renderWithProviders(
      <FlagDetailPane
        model={MODEL}
        flag={FIRST_FLAG}
        flagCount={MODEL.flags.length}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectFlag={vi.fn()}
      />
    )
    expect(screen.getByRole('heading', { name: FIRST_FLAG.title })).toBeInTheDocument()
    expect(screen.getByText(FIRST_FLAG.rubricLabel)).toBeInTheDocument()
  })

  it('keeps navigation in the master Flag list', () => {
    renderWithProviders(
      <FlagDetailPane
        model={MODEL}
        flag={FIRST_FLAG}
        flagCount={MODEL.flags.length}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectFlag={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Previous flag')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next flag')).not.toBeInTheDocument()
  })

  it('hides screenshots for shareable checks', () => {
    const shareableFlag = { ...FIRST_FLAG, checkId: 'og-image-missing' }
    renderWithProviders(
      <FlagDetailPane
        model={MODEL}
        flag={shareableFlag}
        flagCount={MODEL.flags.length}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectFlag={vi.fn()}
      />
    )
  })

  it('renders the evidence line once, not one copy per breakpoint', () => {
    const flagWithEvidence = { ...FIRST_FLAG, evidence: 'The hero says nothing about the outcome.' }
    renderWithProviders(
      <FlagDetailPane
        model={MODEL}
        flag={flagWithEvidence}
        flagCount={MODEL.flags.length}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectFlag={vi.fn()}
      />
    )
    expect(screen.getAllByText((content) => content.includes(flagWithEvidence.evidence))).toHaveLength(1)
  })

  it('does not add redundant navigation for a single flag', () => {
    renderWithProviders(
      <FlagDetailPane
        model={MODEL}
        flag={FIRST_FLAG}
        flagCount={1}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSelectFlag={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Previous flag')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next flag')).not.toBeInTheDocument()
  })
})
