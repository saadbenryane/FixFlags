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
    expect(screen.getByRole('status')).toHaveTextContent(/Step 2 of 5/)
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
    expect(screen.queryByText('How FixFlags is checking')).not.toBeInTheDocument()
  })

  it('shows the progressive timeline title when events are present', () => {
    render(
      <AuditReportProgressive
        status="CAPTURING"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />
    )
    expect(screen.getByText('How FixFlags is checking')).toBeInTheDocument()
    expect(screen.getByText('Opened page')).toBeInTheDocument()
  })

  it('keeps the completed frame focused on all fixes', () => {
    render(<AuditReportProgressive status="COMPLETED" url={URL} score={82} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'All fixes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Flags' })).not.toBeInTheDocument()
  })

  it('streams every partial flag into the same Fix list as they are found', async () => {
    const partialFlags = Array.from({ length: 5 }, (_, index) => ({
      id: `f${index + 1}`,
      severity: index === 0 ? 'CRITICAL' : 'IMPORTANT',
      problem: `Discovered issue ${index + 1}`,
      rubric: index % 2 === 0 ? 'MESSAGE' : 'EXPERIENCE',
    }))
    render(
      <AuditReportProgressive
        status="CHECKING"
        url={URL}
        flagCount={partialFlags.length}
        partialFlags={partialFlags}
      />
    )
    for (const flag of partialFlags) {
      expect((await screen.findAllByText(flag.problem)).length).toBeGreaterThan(0)
    }
  })

  it('mounts explorer chrome before the first flag arrives', () => {
    render(<AuditReportProgressive status="CHECKING" url={URL} />)
    expect(screen.getAllByText(/Checking for issues|Flags appear here/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Step \d+ of \d+/).length).toBeGreaterThan(0)
  })

  it('shows an honest stage label instead of rotating activity copy', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} />)
    expect(screen.getByText(/Scanning · Capturing screenshots/)).toBeInTheDocument()
    expect(screen.getAllByText(/Desktop and mobile views/).length).toBeGreaterThan(0)
  })

  it('falls back to a skeleton frame while screenshots are pending', () => {
    const { container } = render(<AuditReportProgressive status="CHECKING" url={URL} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Reading technology signals')).toBeInTheDocument()
    expect(screen.getByLabelText('Capturing page screenshot')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('replaces the stack skeleton with verified progressive detections', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        url={URL}
        technologyProfile={{
          status: 'complete',
          detectorVersion: 'test',
          detectedAt: new Date().toISOString(),
          technologies: [{
            slug: 'next-js',
            name: 'Next.js',
            category: 'framework',
            confidenceBand: 'verified',
            evidence: [{ type: 'resource', label: 'Next.js assets under /_next/' }],
          }],
          insight: 'FixFlags verified one public technology on this site.',
        }}
      />
    )
    expect(screen.getByRole('heading', { name: 'Made with' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Reading technology signals')).not.toBeInTheDocument()
  })
})
