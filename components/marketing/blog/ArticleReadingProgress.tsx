'use client'

import { useEffect, useRef, useState } from 'react'
import { BLOG_PAGE } from '@/lib/marketing/copy/blog'
import s from './BlogEditorial.module.css'

export function ArticleReadingProgress({ articleId }: { articleId: string }) {
  const marker = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const article = document.getElementById(articleId)
    if (!article) return
    let frame: number | null = null

    const update = () => {
      frame = null
      const rect = article.getBoundingClientRect()
      if (rect.height <= 0) {
        setProgress(0)
        return
      }
      const top = rect.top + window.scrollY
      const start = top - (marker.current?.getBoundingClientRect().bottom ?? 0)
      const end = top + rect.height - window.innerHeight
      const distance = end - start
      const value = distance > 0 ? (window.scrollY - start) / distance : window.scrollY >= start ? 1 : 0
      setProgress(Math.round(Math.max(0, Math.min(1, value)) * 100))
    }

    const queueUpdate = () => {
      if (frame === null) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', queueUpdate, { passive: true })
    window.addEventListener('resize', queueUpdate)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queueUpdate)
    observer?.observe(article)

    return () => {
      window.removeEventListener('scroll', queueUpdate)
      window.removeEventListener('resize', queueUpdate)
      observer?.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [articleId])

  return <div
    ref={marker}
    className={s.progress}
    role="progressbar"
    aria-label={BLOG_PAGE.readingProgress}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={progress}
  ><div className={s.progressFill} style={{ transform: `scaleX(${progress / 100})` }} /></div>
}
