'use client'

import { useLayoutEffect, type RefObject } from 'react'
import { BOTTOM_NOTICE_EVENT } from './useFixedBottomNotice'

/** Floating controls yield visually without removing keyboard or live-region access. */
export function useFocusYield(ref: RefObject<HTMLElement | null>, selector?: string) {
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const yieldFocus = (yielding: boolean) => {
      if (yielding) element.setAttribute('data-yielding-to-focus', 'true')
      else element.removeAttribute('data-yielding-to-focus')
    }
    function measure() {
      cancelAnimationFrame(frame)
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || focused === document.body || focused === document.documentElement || element!.contains(focused)) {
        yieldFocus(false)
        return
      }
      const focus = focused.getBoundingClientRect()
      const obstacles = selector ? [...element!.querySelectorAll<HTMLElement>(selector)] : [element!]
      yieldFocus(obstacles.some(obstacle => {
        const box = obstacle.getBoundingClientRect()
        return box.right > box.left && box.bottom > box.top &&
          box.bottom > focus.top && box.top < focus.bottom && box.right > focus.left && box.left < focus.right
      }))
      if (obstacles.some(obstacle => obstacle.getAnimations?.().some(animation => animation.playState === 'running'))) queue()
    }
    const queue = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    const mutations = new MutationObserver(queue)
    mutations.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-visible', 'data-removed', 'style', 'class'] })
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(queue) : null
    resize?.observe(document.body)
    document.addEventListener('focusin', measure)
    document.addEventListener('focusout', queue)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    window.addEventListener(BOTTOM_NOTICE_EVENT, measure)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      resize?.disconnect()
      document.removeEventListener('focusin', measure)
      document.removeEventListener('focusout', queue)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      window.removeEventListener(BOTTOM_NOTICE_EVENT, measure)
      yieldFocus(false)
    }
  }, [ref, selector])
}
