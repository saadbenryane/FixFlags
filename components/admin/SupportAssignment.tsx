'use client'
import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { useId, useState } from 'react'
import useSWR from 'swr'
import { Input } from '@/components/ui/input'
import { AdminActionButton } from './AdminActionButton'
export function SupportAssignment({
  sessionId,
  onChanged,
}: {
  sessionId: string
  onChanged: () => void
}) {
  const id = useId(),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState('')
  const { data, error, isLoading } = useSWR<{
    operators: Array<{ id: string; name: string | null; email: string }>
    hasMore: boolean
  }>(`/api/admin/operators?q=${encodeURIComponent(query)}`, async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not load administrators')
    return response.json()
  })
  return (
    <details className="px-4 text-sm">
      <summary className="cursor-pointer py-3">Assign to another administrator</summary>
      <div className="space-y-3 pb-4">
        <label htmlFor={id}>Find an administrator</label>
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected('')
          }}
          maxLength={200}
        />
        {error && <p role="alert">Could not load administrators. Change the search to retry.</p>}
        {isLoading && <p role="status">Loading administrators…</p>}
        <label htmlFor={`${id}-choice`} className="block">
          Administrator
        </label>
        <InteractiveSelect
          id={`${id}-choice`}
          className="h-11 w-full rounded-input border bg-background px-3"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose an administrator</option>
          {(data?.operators ?? []).map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name ?? operator.email}
            </option>
          ))}
        </InteractiveSelect>
        {data?.hasMore && (
          <p className="text-xs text-muted-foreground">
            Refine the search to see more administrators.
          </p>
        )}
        {selected && (
          <AdminActionButton
            action="SUPPORT_ASSIGN"
            targetId={sessionId}
            input={{ assigneeId: selected }}
            onCompleted={onChanged}
          />
        )}
      </div>
    </details>
  )
}
