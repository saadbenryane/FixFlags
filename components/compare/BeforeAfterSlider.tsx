'use client'
import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'

interface Props {
  beforeUrl: string
  afterUrl: string
}

export function BeforeAfterSlider({ beforeUrl, afterUrl }: Props) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const updatePosition = useCallback((clientX: number) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    setPosition((x / rect.width) * 100)
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border select-none cursor-col-resize"
      style={{ aspectRatio: '16/9' }}
      onMouseDown={(e) => { dragging.current = true; updatePosition(e.clientX) }}
      onMouseMove={(e) => { if (dragging.current) updatePosition(e.clientX) }}
      onMouseUp={() => { dragging.current = false }}
      onMouseLeave={() => { dragging.current = false }}
      onTouchMove={(e) => updatePosition(e.touches[0].clientX)}
    >
      {/* After (full layer) */}
      <div className="absolute inset-0">
        <Image src={afterUrl} alt="After" fill className="object-cover object-top" unoptimized />
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">After</div>
      </div>

      {/* Before (clipped with clip-path) */}
      <div className="absolute inset-0">
        <Image
          src={beforeUrl}
          alt="Before"
          fill
          className="object-cover object-top"
          unoptimized
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        />
        <div
          className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          Before
        </div>
      </div>

      {/* Divider handle */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg border flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4 2L1 6L4 10M8 2L11 6L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  )
}
