'use client'

import { useEffect } from 'react'
import { sampleStatusLabel } from '@/lib/marketing/display-meta'
import type { SampleSource } from '@/lib/marketing/live-sample'

export function DevSampleMetaLogger({
  source,
  completedAt,
  pipelineVersion,
  isDogfood,
  isDemoFixture,
}: {
  source: SampleSource
  completedAt?: Date | string | null
  pipelineVersion?: string | null
  isDogfood?: boolean
  isDemoFixture?: boolean
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    const label = sampleStatusLabel(source, {
      version: pipelineVersion ?? undefined,
      completedAt,
      isDogfood,
      isDemoFixture,
      marketing: true,
    })

    // dev-only diagnostic, NODE_ENV guarded above
    console.info('[FixFlags sample meta]', {
      source,
      pipelineVersion,
      completedAt,
      isDemoFixture,
      isDogfood,
      label,
    })
  }, [source, completedAt, pipelineVersion, isDogfood, isDemoFixture])

  return null
}
