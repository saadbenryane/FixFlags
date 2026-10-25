'use client'

import { useEffect } from 'react'
import { parseSiteContinuation, SITE_CONTINUATION_PREFIX, siteNavigationRoot, siteReturnFocus, type SiteContinuation } from '@/lib/sites/navigation-continuity'

/** Authentication leaves the workspace. Keep its browser-local reading position across that transition. */
export function useSiteNavigationContinuity(siteId: string) {
  useEffect(() => {
    const current = new URL(window.location.href)
    const root = siteNavigationRoot(current.pathname)
    if (!root) return
    const key = SITE_CONTINUATION_PREFIX + root
    const remove = () => { try { sessionStorage.removeItem(key) } catch { /* Browser-local storage may be disabled. */ } }
    let raw: string | null = null
    try { raw = sessionStorage.getItem(key) } catch { /* Route context remains in the authentication destination. */ }
    const saved = parseSiteContinuation(raw, current, Date.now())
    if (raw && !saved) remove()

    let observer: MutationObserver | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined
    let stopped = false
    const stop = () => {
      stopped = true
      observer?.disconnect()
      if (timer) clearTimeout(timer)
      if (frame !== undefined) cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', cancel)
      document.removeEventListener('keydown', cancel)
    }
    const cancel = () => { remove(); stop() }
    if (saved) {
      const restore = () => {
        if (stopped || frame !== undefined) return
        const container = saved.dialogTop !== null
          ? document.querySelector<HTMLElement>('[role="dialog"][data-state="open"][data-site-return-context="category"]')
          : document.getElementById('main-content')
        if (!container) return
        const accountControl = saved.focus === 'account' && saved.dialogTop === null
          ? [...document.querySelectorAll<HTMLElement>('[data-site-return-focus="account"]')]
            .find(control => control.getClientRects().length > 0 && !control.matches(':disabled,[aria-disabled="true"]'))
          : null
        if (saved.focus === 'account' && !accountControl) return
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            frame = undefined
            if (stopped || !container.isConnected) return
            const control = accountControl ?? container.querySelector<HTMLElement>(`[data-site-return-focus="${saved.focus}"]`)
            const target = control && !control.matches(':disabled,[aria-disabled="true"]') ? control : container
            window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' })
            if (saved.dialogTop !== null) {
              const body = container.querySelector<HTMLElement>('[data-dialog-scroll]')
              if (body) body.scrollTop = saved.dialogTop
            }
            target.focus({ preventScroll: true })
            remove()
            stop()
          })
        })
      }
      observer = new MutationObserver(restore)
      observer.observe(document.body, { childList: true, subtree: true })
      document.addEventListener('pointerdown', cancel, { once: true })
      document.addEventListener('keydown', cancel, { once: true })
      timer = setTimeout(cancel, 5000)
      restore()
    }

    const remember = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const anchor = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-site-auth-next],a[href]') : null
      if (!anchor) return
      let next = anchor.dataset.siteAuthNext
      if (!next) {
        if (!(anchor instanceof HTMLAnchorElement) || anchor.target && anchor.target !== '_self' || anchor.hasAttribute('download')) return
        const auth = new URL(anchor.href, window.location.href)
        if (auth.origin !== window.location.origin || !['/sign-in', '/sign-up', '/post-login'].includes(auth.pathname)) return
        next = auth.searchParams.get('next') ?? undefined
      }
      if (!next?.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return
      let destination = new URL(next, window.location.origin)
      const source = new URL(window.location.href)
      if (destination.origin !== source.origin || siteNavigationRoot(destination.pathname) !== root) return
      if (anchor.dataset.siteAuthContext === 'current') destination = source
      const sameContext = destination.pathname === source.pathname && destination.search === source.search && destination.hash === source.hash
      const dialog = sameContext ? anchor.closest<HTMLElement>('[role="dialog"][data-site-return-context="category"]') : null
      const state: SiteContinuation = { version: 1, destination: destination.pathname + destination.search + destination.hash,
        recordedAt: Date.now(), x: sameContext ? Math.max(0, window.scrollX) : 0, y: sameContext ? Math.max(0, window.scrollY) : 0,
        dialogTop: dialog ? Math.max(0, dialog.querySelector<HTMLElement>('[data-dialog-scroll]')?.scrollTop ?? 0) : null,
        focus: sameContext ? siteReturnFocus(anchor.closest<HTMLElement>('[data-site-return-focus]')?.dataset.siteReturnFocus) : 'context' }
      try { sessionStorage.setItem(key, JSON.stringify(state)) } catch { /* Never block authentication when local storage is unavailable. */ }
    }
    document.addEventListener('click', remember, true)
    return () => { stop(); document.removeEventListener('click', remember, true) }
  }, [siteId])
}
