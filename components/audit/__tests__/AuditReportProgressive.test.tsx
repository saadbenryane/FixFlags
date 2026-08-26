import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  AuditReportProgressive,
} from '@/components/audit/AuditReportProgressive'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { formatQueueWaitHint, REPORT_COPY } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => `/report/${AUDIT_ID}`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

  it('shows capturing progress with Agent selected and the Report mounted', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="anonymous_teaser"
        status="CAPTURING"
        url={URL}
      />,
    )
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('tab', { name: 'Agent' }).some(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      ),
    ).toBe(true)
    expect(screen.getAllByPlaceholderText(/Ask about this report|Send a message/i).length).toBeGreaterThan(0)
  })

  it('keeps product contract out of the immersive scanning workspace', () => {
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
    expect(screen.queryByText(/Help teams ship/i)).not.toBeInTheDocument()
  })

  it('hides the action timeline when there are no events', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} actionTimeline={[]} />)
    expect(screen.queryByText('How FixFlags is checking')).not.toBeInTheDocument()
  })

  it('keeps raw action events out of the Agent transcript', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="owner"
        status="CAPTURING"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />
    )
    expect(screen.queryByText('Activity')).not.toBeInTheDocument()
    expect(screen.queryByText('Opened page')).not.toBeInTheDocument()
  })

  it('renders the completed hold frame through the immersive split shell', () => {
    render(<AuditReportProgressive auditId={AUDIT_ID} status="COMPLETED" url={URL} score={82} />)
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    // The hold frame matches the completed report: outcome bar and Flag explorer.
    expect(screen.getByRole('region', { name: REPORT_COPY.workspace.summaryLabel })).toBeInTheDocument()
    expect(screen.getByLabelText('Score 82')).toBeInTheDocument()
    expect(screen.queryByText('Review context')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Report sections' })).not.toBeInTheDocument()
  })

  it('requires an auditId to render a completed report', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<AuditReportProgressive status="COMPLETED" url={URL} score={82} />),
    ).toThrow(/requires an auditId/)
    consoleError.mockRestore()
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
    expect((await screen.findAllByText('Discovered issue 1')).length).toBeGreaterThan(0)
  })

  it('mounts explorer chrome before the first flag arrives', () => {
    render(<AuditReportProgressive status="CHECKING" url={URL} />)
    expect(screen.getAllByText(/Checking for issues|Flags appear here/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Step \d+ of \d+/).length).toBeGreaterThan(0)
  })

  it('shows an honest stage label in the Agent transcript instead of a Working percent strip', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        status="CAPTURING"
        url={URL}
        agentMessages={[
          {
            id: 'scan:capturing',
            sessionId: AUDIT_ID,
            auditId: AUDIT_ID,
            role: 'agent',
            source: 'scan',
            kind: 'progress',
            state: 'active',
            content: 'I’m opening the Product on desktop and mobile to see what customers see.',
          },
        ]}
      />,
    )
    expect(screen.queryByText('Working')).not.toBeInTheDocument()
    expect(
      screen.getAllByText(/opening the Product on desktop and mobile/i).length,
    ).toBeGreaterThan(0)
  })

  it('keeps the progressive Report mounted while evidence is pending', () => {
    const { container } = render(
      <AuditReportProgressive auditId={AUDIT_ID} status="CHECKING" url={URL} />
    )
    expect(screen.getAllByText('example.com').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Reading technology signals')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('tab', { name: 'Agent' }).some(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      ),
    ).toBe(true)
    expect(container.querySelector('img')).toBeNull()
  })

  it('streams into Agent and Report without exposing Preview controls', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="owner"
        status="CAPTURING"
        url={URL}
        screenshots={[
          { device: 'DESKTOP', url: '/desktop.png', width: 1280, height: 900 },
        ]}
        screenshotCapture={{ desktop: 'ok', mobile: 'failed' }}
      />
    )
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Agent' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Report' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Desktop' })).not.toBeInTheDocument()
  })

  it('keeps technology detections out of the immersive scanning workspace', () => {
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
    expect(screen.queryByRole('heading', { name: 'Made with' })).not.toBeInTheDocument()
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
    expect(screen.getByText(/Found 2 Flags so far/i)).toBeInTheDocument()
    expect(screen.getByText(/Checks are still running/i)).toBeInTheDocument()
    expect(screen.getAllByText('CTA lacks an outcome').length).toBeGreaterThan(0)
  })

  it('shows gated Copy chrome on teaser flags without the prompt body', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="anonymous_teaser"
        status="CHECKING"
        progress={45}
        url={URL}
        partialFlags={[
          {
            id: 'f1',
            severity: 'CRITICAL',
            problem: 'CTA lacks an outcome',
            rubric: 'MESSAGE',
            fix: 'Name the outcome in the primary CTA.',
          },
        ]}
      />
    )
    expect(screen.getByText('Fix Prompt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy prompt' })).toBeInTheDocument()
    expect(screen.queryByText('Name the outcome in the primary CTA.')).not.toBeInTheDocument()
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
    expect(screen.queryByText(/Flags so far/i)).not.toBeInTheDocument()
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
    expect(screen.queryByText(/Preparing Funnel review/)).not.toBeInTheDocument()
  })

  it('keeps the Funnel substep on full pipeline scans', () => {
    render(
      <AuditReportProgressive
        status="CHECKING"
        progress={45}
        url={URL}
        isTeaser={false}
      />
    )
    expect(screen.getAllByText(/Preparing Funnel review/).length).toBeGreaterThan(0)
  })

  it('parks Timeline playback for an owner while keeping the Report available', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="owner"
        status="COMPLETED"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />,
    )

    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('tab', { name: 'Timeline' })).toHaveLength(0)
    expect(screen.queryByRole('slider', { name: 'Scrub through the review path' })).not.toBeInTheDocument()
  })

  it('lets a signed-out public viewer ask to sign in instead of locking the composer', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="public_viewer"
        status="COMPLETED"
        url={URL}
        actionTimeline={[{ t: 500, kind: 'capture', label: 'Opened page' }]}
      />,
    )

    expect(screen.queryAllByRole('tab', { name: 'Timeline' })).toHaveLength(0)
    expect(screen.getByPlaceholderText('Send a message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in to chat' })).toBeInTheDocument()
  })

  it('offers report claim only to the anonymous teaser context', () => {
    render(
      <AuditReportProgressive
        auditId={AUDIT_ID}
        accessContext="anonymous_teaser"
        status="COMPLETED"
        url={URL}
      />,
    )

    expect(screen.getAllByRole('tab', { name: 'Agent' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('tab', { name: 'Report' }).length).toBeGreaterThan(0)
  })
})
