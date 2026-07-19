import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { getScanningLabel } from '@/lib/audit/progress-ui'
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

  it('labels the scan with the current pipeline stage', () => {
    render(<AuditReportProgressive status="CAPTURING" url={URL} />)
    expect(screen.getByText(getScanningLabel('CAPTURING', 0))).toBeInTheDocument()
  })

  it('streams partial flags into the explorer as they are found', async () => {
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
    // LiveReportExplorer is code-split via next/dynamic - wait for the chunk.
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
