const routeState=vi.hoisted(()=>({pathname:'/'}))
vi.mock('next/navigation',()=>({usePathname:()=>routeState.pathname}))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import { ANALYTICS_CONSENT_COPY } from '@/lib/marketing/copy'
import {
  ANALYTICS_CONSENT_COOKIE,
  ANALYTICS_PREFERENCES_EVENT,
} from '@/lib/analytics/consent'
import { CLICK_IDS_COOKIE } from '@/lib/analytics/click-ids'

vi.mock('next/script', () => ({
  default: ({ id, src }: { id?: string; src?: string }) => (
    <span data-testid="analytics-script" data-id={id} data-src={src} />
  ),
}))

describe('ConversionScripts consent', () => {
  beforeEach(() => {
    routeState.pathname='/'
    vi.stubEnv('NEXT_PUBLIC_GA_ID', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-test')
    vi.stubEnv('NEXT_PUBLIC_META_PIXEL_ID', 'pixel-test')
  })

  afterEach(() => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=; Max-Age=0; Path=/`
    document.cookie = `${CLICK_IDS_COOKIE}=; Max-Age=0; Path=/`
    window.history.replaceState({}, '', '/')
    document.documentElement.style.paddingTop = ''
    document.documentElement.style.paddingBottom = ''
    delete window.dataLayer
    delete window.gtag
    delete window.fbq
    sessionStorage.clear()
    vi.unstubAllEnvs()
  })

  it('explains the choice without calling the work a product journey', async () => {
    render(<ConversionScripts />)
    expect(ANALYTICS_CONSENT_COPY.body).toContain('see how people use FixFlags')
    expect(ANALYTICS_CONSENT_COPY.body.toLowerCase()).not.toMatch(/journey/)
    expect(await screen.findByText(ANALYTICS_CONSENT_COPY.body)).toBeVisible()
  })

  it('requires an explicit choice and remembers necessary-only', async () => {
    render(<ConversionScripts />)

    const dialog = await screen.findByRole('dialog', { name: 'Choose your analytics settings' })
    expect(dialog).toBeVisible()
    expect(dialog.className).toContain('bottom-[')
    expect(dialog.className).not.toContain('top-3')
    expect(dialog).toHaveAccessibleDescription(ANALYTICS_CONSENT_COPY.body)
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.documentElement.style.paddingBottom).toBe('')
    fireEvent(window, new Event('resize'))
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.documentElement.style.paddingBottom).toBe('')
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.documentElement.style.paddingTop).toBe('')
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=denied`)
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })

  it('keeps visitor-specific consent out of the prerendered HTML', () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    expect(renderToString(<ConversionScripts />)).toBe('')
  })

  it.each(['granted', 'denied'])('does not flash the prompt for a remembered %s choice', async (choice) => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${choice}; Path=/`
    render(<ConversionScripts />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryAllByTestId('analytics-script').length > 0).toBe(choice === 'granted')
    })
  })

  it('requests an explicit choice when the stored value is invalid', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=invalid; Path=/`
    render(<ConversionScripts />)
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })

  it('loads analytics and captures attribution only after allowing analytics', async () => {
    window.history.replaceState({}, '', '/?gclid=test-click')
    render(<ConversionScripts />)
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
    expect(document.cookie).not.toContain(CLICK_IDS_COOKIE)

    fireEvent.click(await screen.findByRole('button', { name: 'Allow analytics' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('analytics-script')).toHaveLength(2)
    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`)
    expect(document.cookie).toContain(CLICK_IDS_COOKIE)
  })

  it('reopens preferences so an earlier choice can be changed', async () => {
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=denied; Path=/`
    render(<ConversionScripts />)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    expect(await screen.findByRole('dialog', { name: 'Choose your analytics settings' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Allow analytics' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Allow analytics' }))

    expect(document.cookie).toContain(`${ANALYTICS_CONSENT_COOKIE}=granted`)
  })

  it('preserves page spacing when preferences reopen or are dismissed', async () => {
    document.documentElement.style.paddingTop = '17px'
    document.documentElement.style.paddingBottom = '23px'
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    render(<ConversionScripts />)

    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    expect(await screen.findByRole('dialog')).toBeVisible()
    fireEvent(window, new Event('resize'))
    fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }))

    expect(document.documentElement.style.paddingTop).toBe('17px')
    expect(document.documentElement.style.paddingBottom).toBe('23px')
    expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument()
  })

  it.each([null, 'denied'])('loads only GA with storage denied for a %s choice', async (choice) => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    if (choice) document.cookie = `${ANALYTICS_CONSENT_COOKIE}=${choice}; Path=/`
    render(<ConversionScripts />)

    const scripts = await screen.findAllByTestId('analytics-script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0]).toHaveAttribute('data-src', 'https://www.googletagmanager.com/gtag/js?id=G-TEST12345')
    const commands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    expect(commands[0]).toEqual(['consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
    expect(commands.filter(([command]) => command === 'config')).toHaveLength(1)
    expect(commands.some(([, target]) => target === 'AW-test')).toBe(false)
    expect(document.cookie).not.toContain(CLICK_IDS_COOKIE)
    expect(sessionStorage.length).toBe(0)
  })

  it('updates Google consent on withdrawal and keeps only cookieless GA loaded', async () => {
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST12345')
    document.cookie = `${ANALYTICS_CONSENT_COOKIE}=granted; Path=/`
    document.cookie = `${CLICK_IDS_COOKIE}=test-click; Path=/`
    sessionStorage.setItem('ff:analytics-journey:v1', 'old-journey')
    render(<ConversionScripts />)
    await screen.findAllByTestId('analytics-script')
    const fbq = vi.fn()
    window.fbq = fbq
    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    fireEvent.click(await screen.findByRole('button', { name: 'Only necessary' }))

    const commands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    expect(commands.at(-1)).toEqual(['consent', 'update', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    }])
    expect(screen.getAllByTestId('analytics-script')).toHaveLength(1)
    expect(fbq).toHaveBeenCalledWith('consent', 'revoke')
    expect(document.cookie).not.toContain(CLICK_IDS_COOKIE)
    expect(sessionStorage.getItem('ff:analytics-journey:v1')).toBeNull()

    act(() => window.dispatchEvent(new Event(ANALYTICS_PREFERENCES_EVENT)))
    fireEvent.click(await screen.findByRole('button', { name: 'Allow analytics' }))
    const updatedCommands = window.dataLayer!.map((command) => Array.from(command as IArguments))
    expect(updatedCommands.filter(([command, target]) => command === 'config' && target === 'G-TEST12345')).toHaveLength(1)
    expect(window.dataLayer!.filter((command) => (command as IArguments)[0] === 'js')).toHaveLength(1)
    expect(fbq).toHaveBeenLastCalledWith('consent', 'grant')
  })
})

describe('private administrator surfaces',()=>{
 it('does not load scripts or show a marketing prompt in admin',()=>{routeState.pathname='/admin/users/private-customer';vi.stubEnv('NEXT_PUBLIC_GA_ID','G-PRIVATE');render(<ConversionScripts />);expect(screen.queryByTestId('analytics-script')).not.toBeInTheDocument();expect(screen.queryByText(ANALYTICS_CONSENT_COPY.title)).not.toBeInTheDocument();expect((window as unknown as Record<string,unknown>)['ga-disable-G-PRIVATE']).toBe(true);routeState.pathname='/';vi.unstubAllEnvs()})
})
