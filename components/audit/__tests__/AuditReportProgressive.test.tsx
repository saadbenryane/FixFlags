import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { formatQueueWaitHint } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'

const URL = 'https://example.com'

afterEach(() => {
  sessionStorage.clear()
})

describe('AuditReportProgressive', () => {
  it('warns when the worker is idle instead of pretending to progress', () => {
    render(<AuditReportProgressive status="QUEUED" url={URL} workerIdle />)
    expect(screen.getByText('Still preparing')).toBeInTheDocument()
    expect(screen.getByText(getWorkerQueuedWarning(true))).toBeInTheDocument()
  })

  it('shows the real queue-wait estimate while queued', () => {
    setActiveAudit({ auditId: 'a1', url: URL, estimatedWaitSeconds: 90 })
    render(<AuditReportProgressive status="QUEUED" url={URL} />)
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText(formatQueueWaitHint(90))).toBeInTheDocument()
  })

  it('suppresses the queue hint for short waits', () => {
    setActiveAudit({ auditId: 'a1', url: URL, estimatedWaitSeconds: 3 })
    render(<AuditReportProgressive status="QUEUED" url={URL} />)
    expect(screen.queryByText('Queued')).not.toBeInTheDocument()
  })

  it('shows capturing progress with an honest pending score', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/Score pending/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Scanning/i).length).toBeGreaterThan(0)
  })

  it('renders product contract when provided', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        url={URL}
        productContract={{
          purpose: 'Help teams ship',
          firstValueJourney: 'Paste URL, get Flags',
          criticalOutcomes: ['Clear CTA'],
          source: 'heuristic',
          inferredAt: new Date().toISOString(),
        }}
      />
    )
    expect(screen.getByText(/Help teams ship/i)).toBeInTheDocument()
  })

  it('hides the action timeline when there are no events', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} actionTimeline={[]} />)
    expect(screen.queryByText('What FixFlags is doing')).not.toBeInTheDocument()
  })

  it('shows the progressive timeline title when events are present', () => {
    render(
      <AuditReportProgressive
        status="CAPTURING"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />
    )
    expect(screen.getByText('What FixFlags is doing')).toBeInTheDocument()
    expect(screen.getByText('Opened page')).toBeInTheDocument()
  })

  it('keeps the completed frame focused on the Finish Plan', () => {
    render(<AuditReportProgressive status="COMPLETED" url={URL} score={82} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Finish Plan' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flags' })).not.toBeInTheDocument()
  })

  it('streams partial flags into the Finish Plan as they are found', async () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        url={URL}
        flagCount={1}
        partialFlags={[
          { id: 'f1', severity: 'CRITICAL', problem: 'Headline promises nothing', rubric: 'MESSAGE' },
        ]}
      />
    )
    expect(
      (await screen.findAllByText('Headline promises nothing')).length
    ).toBeGreaterThan(0)
  })

  it('falls back to a skeleton frame while screenshots are pending', () => {
    const { container } = render(<AuditReportProgressive status="CHECKING" url={URL} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(container.querySelector('img')).toBeNull()
  })
})
