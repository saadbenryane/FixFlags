import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  AuditReportProgressive,
  AuditReportProgressiveShell,
} from '@/components/audit/AuditReportProgressive'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { formatQueueWaitHint } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'

const URL = 'https://example.com'

afterEach(() => {
  sessionStorage.clear()
  localStorage.clear()
})

describe('AuditReportProgressive', () => {
  it('uses a neutral route shell until the real audit state is known', () => {
    render(<AuditReportProgressiveShell />)
    expect(screen.getByRole('heading', { name: 'Loading report…' })).toBeInTheDocument()
    expect(screen.queryByText(/Starting check/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Queued/i)).not.toBeInTheDocument()
  })

  it('warns when the worker is idle instead of pretending to progress', () => {
    render(<AuditReportProgressive status="QUEUED" url={URL} workerIdle />)
    expect(screen.getByText('Still preparing')).toBeInTheDocument()
    expect(screen.getByText(getWorkerQueuedWarning(true))).toBeInTheDocument()
  })

  it('shows the real queue-wait estimate while queued', () => {
    setActiveAudit({
      auditId: 'a1',
      url: URL,
      queue: {
        state: 'waiting',
        jobsAhead: 2,
        estimatedWaitSeconds: 90,
        scheduledStartAt: null,
        workerAvailable: true,
      },
    })
    render(<AuditReportProgressive status="QUEUED" url={URL} />)
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(screen.getByText(formatQueueWaitHint(90))).toBeInTheDocument()
  })

  it('suppresses the queue hint for short waits', () => {
    setActiveAudit({
      auditId: 'a1',
      url: URL,
      queue: {
        state: 'waiting',
        jobsAhead: 0,
        estimatedWaitSeconds: 3,
        scheduledStartAt: null,
        workerAvailable: true,
      },
    })
    render(<AuditReportProgressive status="QUEUED" url={URL} />)
    expect(screen.queryByText('Queued')).not.toBeInTheDocument()
  })

  it('shows capturing progress with an honest pending score', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Step 2 of 5/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Scanning/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Polish pass')).toBeInTheDocument()
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

  it('keeps the completed frame focused on all fixes with sticky wayfinding', () => {
    render(<AuditReportProgressive status="COMPLETED" url={URL} score={82} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'All fixes' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Report sections' })).toBeInTheDocument()
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

  it('resolves desktop and mobile capture frames independently', () => {
    render(
      <AuditReportProgressive
        status="CAPTURING"
        url={URL}
        screenshots={[
          { device: 'DESKTOP', url: '/desktop.png', width: 1280, height: 900 },
        ]}
        screenshotCapture={{ desktop: 'ok', mobile: 'failed' }}
      />
    )
    expect(screen.getByAltText('Desktop screenshot of example.com')).toBeInTheDocument()
    expect(screen.getByText(/Screenshot could not be captured/i)).toBeInTheDocument()
    expect(screen.queryByAltText('Mobile screenshot of example.com')).not.toBeInTheDocument()
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
