'use client'

import { useEffect, useRef } from 'react'
import styles from './GlassHeroMark.module.css'

/** A continuous studio backdrop. Only its light moves, never the photographed glass. */
export function GlassHeroMark() {
  const scene = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = scene.current
    if (!element) return
    const surface = element.parentElement
    if (!surface) return
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)')
    let frame = 0
    let bounds: DOMRect | null = null
    let target = { x: 0, y: 0, power: 0 }
    let light = { ...target }
    let previous: number | null = null

    const reset = () => {
      cancelAnimationFrame(frame)
      frame = 0
      bounds = null
      target = { x: 0, y: 0, power: 0 }
      light = { ...target }
      previous = null
      for (const property of ['--glass-light-x', '--glass-light-y', '--glass-active']) {
        element.style.removeProperty(property)
      }
    }
    const paint = (time: number) => {
      frame = 0
      const elapsed = previous === null ? 1000 / 60 : Math.min(64, Math.max(0, time - previous))
      previous = time
      // Time-based damping behaves consistently on 60 Hz and high-refresh screens.
      const blend = -Math.expm1(-elapsed / 115)
      light = { x: light.x + (target.x - light.x) * blend, y: light.y + (target.y - light.y) * blend,
        power: light.power + (target.power - light.power) * blend }
      const moving = Math.max(Math.abs(target.x - light.x), Math.abs(target.y - light.y), Math.abs(target.power - light.power)) > .001
      if (!moving) light = { ...target }
      element.style.setProperty('--glass-light-x', `${(light.x * 14).toFixed(3)}%`)
      element.style.setProperty('--glass-light-y', `${(light.y * 8).toFixed(3)}%`)
      element.style.setProperty('--glass-active', light.power.toFixed(4))
      if (moving) frame = requestAnimationFrame(paint)
      else { previous = null; if (!target.power) reset() }
    }
    const animate = () => { if (!frame) { previous = null; frame = requestAnimationFrame(paint) } }
    const leave = () => { bounds = null; target = { x: 0, y: 0, power: 0 }; animate() }
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || document.hidden) return
      bounds ??= surface.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      target = {
        x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
        y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)),
        power: 1,
      }
      animate()
    }
    const visibility = () => { if (document.hidden) reset() }
    const detach = () => {
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', leave)
      surface.removeEventListener('pointercancel', reset)
      window.removeEventListener('resize', reset)
      window.removeEventListener('scroll', reset)
      document.removeEventListener('visibilitychange', visibility)
      reset()
    }
    const configure = () => {
      detach()
      if (!motion.matches) return
      surface.addEventListener('pointermove', move, { passive: true })
      surface.addEventListener('pointerleave', leave)
      surface.addEventListener('pointercancel', reset)
      window.addEventListener('resize', reset, { passive: true })
      window.addEventListener('scroll', reset, { passive: true })
      document.addEventListener('visibilitychange', visibility)
    }
    configure()
    motion.addEventListener('change', configure)
    return () => {
      motion.removeEventListener('change', configure)
      detach()
    }
  }, [])

  return <div ref={scene} className={styles.scene} aria-hidden="true">
    <div className={styles.canvas}>
      <div className={styles.studio} />
      <div className={styles.facets}>
        <div className={styles.reflection} />
        <div className={styles.reflectionSoft} />
      </div>
    </div>
  </div>
}
