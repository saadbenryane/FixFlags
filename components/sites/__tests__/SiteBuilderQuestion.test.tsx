import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SiteBuilderQuestion } from '../SiteBuilderQuestion'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

const C = SITE_DASHBOARD_COPY.builderQuestion
const json = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) })

afterEach(() => { vi.unstubAllGlobals() })

describe('builder question', () => {
  it('asks once, records the answer, and reports it to the board', async () => {
    const fetch = vi.fn().mockReturnValueOnce(json({ tool: null })).mockReturnValueOnce(json({ tool: 'cursor' }))
    vi.stubGlobal('fetch', fetch)
    const onAnswer = vi.fn()
    render(<SiteBuilderQuestion siteId="site 1" onAnswer={onAnswer} />)
    const select = await screen.findByRole('combobox', { name: C.title })
    expect(screen.getAllByRole('option')).toHaveLength(C.options.length + 1)
    fireEvent.change(select, { target: { value: 'cursor' } })
    expect(await screen.findByRole('status')).toHaveTextContent(C.saved)
    expect(fetch).toHaveBeenLastCalledWith('/api/sites/site%201/builder', expect.objectContaining({ method: 'POST', body: '{"tool":"cursor"}' }))
    expect(onAnswer).toHaveBeenCalledWith('cursor')
  })

  it('stays hidden when already answered or unavailable, and says when saving fails', async () => {
    const onAnswer = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(json({ tool: 'bolt' })))
    const { unmount } = render(<SiteBuilderQuestion siteId="s" onAnswer={onAnswer} />)
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith('bolt'))
    expect(screen.queryByRole('combobox', { name: C.title })).not.toBeInTheDocument()
    unmount()

    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(json({ tool: null })).mockReturnValueOnce(json({}, false)))
    render(<SiteBuilderQuestion siteId="s" onAnswer={vi.fn()} />)
    fireEvent.change(await screen.findByRole('combobox', { name: C.title }), { target: { value: 'lovable' } })
    expect(await screen.findByRole('alert')).toHaveTextContent(C.failed)
  })
})
