'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { EvidenceHighlight } from '@/lib/audit/evidence-highlights'

interface PreviewEvidenceState {
  selectedFlagId: string | null
  highlights: EvidenceHighlight[]
  setSelection: (next: { flagId: string | null; highlights: EvidenceHighlight[] }) => void
}

const PreviewEvidenceContext = createContext<PreviewEvidenceState | null>(null)

export function PreviewEvidenceProvider({ children }: { children: ReactNode }) {
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<EvidenceHighlight[]>([])

  const setSelection = useCallback(
    ({ flagId, highlights: next }: { flagId: string | null; highlights: EvidenceHighlight[] }) => {
      setSelectedFlagId(flagId)
      setHighlights(next)
    },
    []
  )

  const value = useMemo<PreviewEvidenceState>(
    () => ({
      selectedFlagId,
      highlights,
      setSelection,
    }),
    [highlights, selectedFlagId, setSelection]
  )

  return <PreviewEvidenceContext.Provider value={value}>{children}</PreviewEvidenceContext.Provider>
}

export function usePreviewEvidence(): PreviewEvidenceState {
  const value = useContext(PreviewEvidenceContext)
  if (!value) {
    return {
      selectedFlagId: null,
      highlights: [],
      setSelection: () => {},
    }
  }
  return value
}
