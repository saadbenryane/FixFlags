import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  AuditReportProgressive,
} from '@/components/audit/AuditReportProgressive'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { formatQueueWaitHint } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => `/report/${AUDIT_ID}`,
}))

const URL = 'https://example.com'
const AUDIT_ID = 'audit-progressive-test'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ messages: [], available: true, cap: 20, userTurns: 0 }),
    })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
  localStorage.clear()
})

describe('AuditReportProgressive', () => {
  it('warns when the worker is idle instead of pretending to progress', () => {
    render(<AuditReportProgressive status="QUEUED" url={URL} workerIdle />)
    expect(screen.getByText('Still preparing')).toBeInTheDocument()
    expect(screen.getByText(getWorkerQueuedWarning(true))).toBeInTheDocument()
  })

  it('shows the real queue-wait estimate while queued', () => {
    setActiveAudit({
      auditId: 'a1',
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
    expect(screen.getByLabelText('Top fixes')).toBeInTheDocument()
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

  it('keeps raw action events out of the Agent transcript', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        isOwner
        status="CAPTURING"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />
    )
    expect(screen.queryByText('Activity')).not.toBeInTheDocument()
    expect(screen.queryByText('Opened page')).not.toBeInTheDocument()
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
        auditId={AUDIT_ID}
        isOwner
        status="CAPTURING"
        url={URL}
        screenshots={[
          { device: 'DESKTOP', url: '/desktop.png', width: 1280, height: 900 },
        ]}
        screenshotCapture={{ desktop: 'ok', mobile: 'failed' }}
      />
    )
    fireEvent.click(screen.getAllByRole('tab', { name: 'Timeline' })[0]!)
    expect(screen.getAllByAltText('Page screenshot').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Screenshot could not be captured for this check/i).length).toBeGreaterThan(0)
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

  it('shows a live findings strip while deterministic checks stream', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        progress={45}
        url={URL}
        partialFlags={[
          { id: 'f1', severity: 'CRITICAL', problem: 'CTA lacks an outcome', rubric: 'MESSAGE' },
          { id: 'f2', severity: 'IMPORTANT', problem: 'Slow LCP on mobile', rubric: 'EXPERIENCE' },
        ]}
      />
    )
    expect(screen.getByText(/Found 2 issues so far/i)).toBeInTheDocument()
    expect(screen.getByText(/Checks are still running/i)).toBeInTheDocument()
    expect(screen.getAllByText('CTA lacks an outcome').length).toBeGreaterThan(0)
  })

  it('hides the live findings strip before checks start', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        progress={40}
        url={URL}
        partialFlags={[{ id: 'f1', severity: 'CRITICAL', problem: 'C', rubric: 'MESSAGE' }]}
      />
    )
    expect(screen.queryByText(/issues so far/i)).not.toBeInTheDocument()
  })

  it('keeps the stage narrative honest on teaser scans (no journey walk)', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        progress={45}
        url={URL}
        isTeaser
      />
    )
    expect(screen.getAllByText(/Starting AI review/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Preparing journey review/)).not.toBeInTheDocument()
  })

  it('keeps the journey substep on full pipeline scans', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        progress={45}
        url={URL}
        isTeaser={false}
      />
    )
    expect(screen.getAllByText(/Preparing journey review/).length).toBeGreaterThan(0)
  })
})
