'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FilterPill } from '@/components/ui/filter-pill'

export const EXAMPLE_TAGS = [
  { id: 'all', label: 'All' },
  { id: 'best-practices', label: 'Best practices' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'content-heavy', label: 'Content-heavy' },
  { id: 'agency-ready', label: 'Agency-ready' },
] as const

export type ExampleTagId = (typeof EXAMPLE_TAGS)[number]['id']

interface Props {
  activeTag: ExampleTagId
}

export function ExamplesFilterBar({ activeTag }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function setTag(tag: ExampleTagId) {
    const params = new URLSearchParams(searchParams.toString())
    if (tag === 'all') {
      params.delete('tag')
    } else {
      params.set('tag', tag)
    }
    const query = params.toString()
    router.replace(query ? `/examples?${query}` : '/examples', { scroll: false })
  }

  return (
    <nav aria-label="Filter examples" className="-mx-1 flex flex-wrap gap-2 px-1">
      {EXAMPLE_TAGS.map((tag) => (
        <FilterPill
          key={tag.id}
          active={activeTag === tag.id}
          onClick={() => setTag(tag.id)}
        >
          {tag.label}
        </FilterPill>
      ))}
    </nav>
  )
}
