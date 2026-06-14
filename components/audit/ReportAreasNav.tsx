'use client'

import { useEffect, useState } from 'react'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { AREA_ORDER } from '@/lib/audit/constants'

interface Area {
  name: string
  grade: string | null
  score: number | null
  status: string | null
  findings?: Array<{ id: string }>
}

interface Props {
  areas: Area[]
}

export function ReportAreasNav({ areas }: Props) {
  const [activeArea, setActiveArea] = useState<string | null>(null)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    for (const name of AREA_ORDER) {
      const el = document.getElementById(`area-${name}`)
      if (!el) continue

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveArea(name)
            }
          }
        },
        { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
      )
      observer.observe(el)
      observers.push(observer)
    }

    return () => observers.forEach((o) => o.disconnect())
  }, [areas])

  return (
    <AreaGrid
      areas={areas}
      activeArea={activeArea}
      onAreaClick={(name) => {
        setActiveArea(name)
        const el = document.getElementById(`area-${name}`)
        window.history.replaceState(null, '', `#area-${name}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      showScoreTypes
    />
  )
}
