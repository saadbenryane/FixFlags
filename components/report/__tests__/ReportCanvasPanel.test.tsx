import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportCanvasPanel } from '@/components/report/ReportCanvasPanel'

beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('ReportCanvasPanel', () => {
  it('creates a Canvas only after the user supplies a title and instruction', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ canvas: { id: 'c1' } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)

    render(<ReportCanvasPanel auditId="a1" />)
    await screen.findByText('Create a Canvas from this report')

    const create = screen.getByRole('button', { name: 'Create Canvas' })
    expect(create).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Canvas title'), { target: { value: 'Launch brief' } })
    fireEvent.change(screen.getByPlaceholderText('What should this Canvas emphasize?'), { target: { value: 'Prioritize launch blockers' } })
    fireEvent.click(create)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/reports/a1/canvases', expect.objectContaining({ method: 'POST' })))
  })

  it('renders a validated document and links cited Flags back to the report', async () => {
    const canvas = { id: 'c1', sourceAuditId: 'a1', projectId: 'p1', title: 'Launch brief', status: 'READY', currentVersion: 1 }
    const current = {
      canvasId: 'c1',
      version: 1,
      instruction: 'Launch blockers',
      sourceRefs: [{ id: 'ref:f1', kind: 'flag', auditId: 'a1', entityId: 'f1' }],
      document: {
        schemaVersion: 1,
        title: 'Launch brief',
        summary: 'Two issues need attention.',
        blocks: [{ id: 'b1', type: 'callout', tone: 'warning', title: 'Fix first', text: 'Clarify the headline.', sourceRefIds: ['ref:f1'] }],
      },
    }
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => [canvas] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ canvas, current }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [current] } as Response)

    render(<ReportCanvasPanel auditId="a1" />)

    expect(await screen.findByRole('heading', { name: 'Launch brief' })).toBeInTheDocument()
    expect(screen.getByText('Clarify the headline.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View source' })).toHaveAttribute('href', '/report/a1?flag=f1#report-flags')
  })
})
