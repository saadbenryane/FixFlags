import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomepageDeferredDashboard } from '../HomepageDeferredDashboard'

vi.mock('../HomepageDashboardPreview', () => ({ HomepageDashboardPreview: () => <div role="region" aria-label="Sample dashboard" /> }))

const actions = { onOpen: vi.fn(), onOpenFlag: vi.fn(), onCopyFlag: vi.fn() }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function stubObserver() {
  const observers: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('IntersectionObserver', class {
    disconnect = vi.fn()
    constructor(callback: IntersectionObserverCallback) { observers.push({ callback, disconnect: this.disconnect }) }
    observe() {}
  })
  return observers
}

describe('deferred homepage dashboard', () => {
  it('reserves space and waits until the dashboard nears the viewport', async () => {
    const observers = stubObserver()
    render(<HomepageDeferredDashboard {...actions} />)
    expect(screen.getByTestId('dashboard-placeholder')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('region', { name: 'Sample dashboard' })).not.toBeInTheDocument()

    act(() => observers[0].callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(screen.queryByRole('region', { name: 'Sample dashboard' })).not.toBeInTheDocument()

    act(() => observers[0].callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(await screen.findByRole('region', { name: 'Sample dashboard' })).toBeInTheDocument()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('loads immediately when eager or when visibility cannot be observed', async () => {
    stubObserver()
    const { unmount } = render(<HomepageDeferredDashboard eager {...actions} />)
    expect(await screen.findByRole('region', { name: 'Sample dashboard' })).toBeInTheDocument()
    unmount()

    vi.stubGlobal('IntersectionObserver', undefined)
    render(<HomepageDeferredDashboard {...actions} />)
    expect(await screen.findByRole('region', { name: 'Sample dashboard' })).toBeInTheDocument()
  })

})
