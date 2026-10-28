import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SiteFixBundleButton } from '../SiteFixBundleButton'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(options.body as string)
    if (url.endsWith('/fix-prompt')) {
      const ids = body.flagIds ?? ['first', 'second']
      return Response.json({ ok: true, prompt: `Repair ${ids.join(', ')}.`,
        tasks: ids.map((sourceFlagId: string) => ({ sourceFlagId, promptHash: 'a'.repeat(64) })) })
    }
    const flagId = url.split('/').at(-2)
    return Response.json({ ok: true, prompt: 'Recorded task', handoff: {
      flagId, action: 'HANDOFF_COPIED', improvementId: `issue-${flagId}`, sourceReviewId: 'audit',
    } })
  }))
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(() => vi.unstubAllGlobals())

it('closes an inspected bundle when its explicit repair selection changes', async () => {
  const rendered = render(<SiteFixBundleButton siteId="site" flagIds={['first']} availability="available" />)
  fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.viewPrompt }))
  expect(await screen.findByRole('textbox')).toHaveValue('Repair first.')
  rendered.rerender(<SiteFixBundleButton siteId="site" flagIds={['second']} availability="available" />)
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: SITE_BOARD_COPY.viewPrompt }))
  expect(await screen.findByRole('textbox')).toHaveValue('Repair second.')
})

it('records every prepared task only after the physical clipboard write completes', async () => {
  let complete!: () => void
  vi.mocked(navigator.clipboard.writeText).mockReturnValue(new Promise(resolve => { complete = resolve }))
  render(<SiteFixBundleButton siteId="site" availability="available" />)
  fireEvent.click(screen.getByRole('button', { name: C.fixAll }))
  await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Repair first, second.'))
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => complete())
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(screen.getByRole('button', { name: C.bundleCopied })).toBeVisible()
})

it('offers manual copying without recording a handoff when clipboard permission is refused', async () => {
  vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Denied'))
  render(<SiteFixBundleButton siteId="site" availability="available" />)
  fireEvent.click(screen.getByRole('button', { name: C.fixAll }))
  expect(await screen.findByRole('textbox')).toHaveValue('Repair first, second.')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: C.bundleCopied })).not.toBeInTheDocument()
})
