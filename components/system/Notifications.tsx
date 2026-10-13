'use client'

import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { BOTTOM_NOTICE_EVENT } from './useFixedBottomNotice'

export function Notifications() {
  const root = useRef<HTMLElement>(null)
  const [yieldsFocus, setYieldsFocus] = useState(false)
  useEffect(() => {
    const element = root.current
    if (!element) return
    let frame = 0
    const measure = () => {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || focused === document.body || focused === document.documentElement ||
          element.contains(focused)) { setYieldsFocus(false); return }
      const focus = focused.getBoundingClientRect()
      setYieldsFocus([...element.querySelectorAll<HTMLElement>('[data-sonner-toast][data-visible="true"]')].some(toast => {
        const box = toast.getBoundingClientRect()
        return box.bottom > focus.top && box.top < focus.bottom && box.right > focus.left && box.left < focus.right
      }))
    }
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const mutations = new MutationObserver(queue)
    mutations.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-visible', 'data-removed'] })
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null
    resize?.observe(document.body)
    document.addEventListener('focusin', queue)
    document.addEventListener('focusout', queue)
    window.addEventListener('resize', queue)
    window.addEventListener(BOTTOM_NOTICE_EVENT, queue)
    return () => {
      cancelAnimationFrame(frame); mutations.disconnect(); resize?.disconnect()
      document.removeEventListener('focusin', queue); document.removeEventListener('focusout', queue)
      window.removeEventListener('resize', queue); window.removeEventListener(BOTTOM_NOTICE_EVENT, queue)
    }
  }, [])
  const offset = { bottom: 'calc(var(--bottom-notice-inset, 0px) + 16px)' }
  return <Toaster ref={root} richColors position="bottom-right" offset={offset} mobileOffset={offset}
    style={{ visibility: yieldsFocus ? 'hidden' : undefined }} />
}
