import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy-barrel'

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), polling: vi.fn(), toast: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }))
vi.mock('@/hooks/useAuditPolling', () => ({ useAuditPolling: mocks.polling }))
vi.mock('@/hooks/useWorkerIdleDetection', () => ({ useWorkerIdleDetection: () => false }))
vi.mock('@/components/audit/AuditReportProgressive', () => ({ AuditReportProgressive: ({ onRetry, retryLoading }: {
  onRetry: () => void; retryLoading: boolean;
}) => <button onClick={onRetry} disabled={retryLoading}>Retry</button> }))
vi.mock('@/components/layout/audit-shell', () => ({ AuditShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/analytics/ReportViewedTracker', () => ({ ReportViewedTracker: () => null }))
vi.mock('@/lib/audit/active-audit', () => ({ setActiveAudit: vi.fn(), clearActiveAudit: vi.fn(), auditHostname: () => 'example.com' }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }))
import { AuditPageClient } from '../AuditPageClient'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.polling.mockReturnValue({ audit: null, isComplete: false, isFailed: true, isNotFound: false, isForbidden: false,
    fetchError: null, error: null, isLoading: false, status: 'FAILED', progress: 0, url: 'https://example.com/', statusPayload: null })
})
afterEach(() => vi.unstubAllGlobals())
function report() {
  return render(<AuditPageClient id="failed-report" session={{ user: { id: 'owner' } }}
    initialAudit={{ url: 'https://example.com/', accessContext: 'owner' }} />)
}

describe('report retry navigation', () => {
  it('opens the admitted execution instead of refreshing the failed report', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'CHECKING', auditId: 'new-check', runId: 'retry-run', reused: true }) })
    vi.stubGlobal('fetch', fetch)
    report(); fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/report/new-check'))
    expect(fetch).toHaveBeenCalledWith('/api/reports/failed-report/retry', { method: 'POST' })
    expect(mocks.refresh).not.toHaveBeenCalled(); expect(mocks.toast).not.toHaveBeenCalled()
  })
  it.each([{}, { status: 'QUEUED' }, { status: 'QUEUED', auditId: 'new-check', unexpected: true }])('retains failure evidence when the response is unconfirmed: %j', async response => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => response }))
    report(); fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(SITE_ACTION_COPY.invalidResponse))
    expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
  })
  it('reports a denied retry without moving away from the recorded failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'This report belongs to another account.' }) }))
    report(); fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith('This report belongs to another account.'))
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
