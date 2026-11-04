'use client'

import { useEffect } from 'react'

/** The rendered Site owns its title across in-place workspace navigation. */
export function useSiteDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      // A subsequent route may already have published its own metadata.
      if (document.title === title) document.title = previous
    }
  }, [title])
}
