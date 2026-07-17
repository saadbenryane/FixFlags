'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { PROJECT_ASSIGN_COPY } from '@/lib/marketing/copy'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  auditId: string
  initialProjectId?: string | null
  enabled: boolean
  compact?: boolean
}

export function ProjectAssignSelect({ auditId, initialProjectId, enabled, compact = false }: Props) {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetch('/api/projects')
      .then(async (res) => {
        if (!res.ok) {
          const parsed = await parseApiErrorResponse(res)
          if (!cancelled) {
            setLoadError(parsed.message || PROJECT_ASSIGN_COPY.loadFailed)
            setProjects([])
          }
          return
        }
        const data = (await res.json()) as ProjectOption[]
        if (!cancelled) {
          setLoadError(null)
          setProjects(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(PROJECT_ASSIGN_COPY.loadFailed)
          setProjects([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (!enabled) return null

  async function handleChange(nextId: string) {
    const resolvedId = nextId === '__none__' ? '' : nextId
    setProjectId(resolvedId)
    setSaving(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: resolvedId || null }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        setProjectId(initialProjectId ?? '')
        return
      }
      toast.success(resolvedId ? PROJECT_ASSIGN_COPY.assigned : PROJECT_ASSIGN_COPY.removed)
    } catch {
      toast.error(PROJECT_ASSIGN_COPY.updateFailed)
      setProjectId(initialProjectId ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1 text-sm">
      <div className="inline-flex items-center gap-2">
        <span className={compact ? 'sr-only' : 'text-muted-foreground'}>Project</span>
        <Select
          value={projectId}
          disabled={saving || Boolean(loadError)}
          onValueChange={(v) => handleChange(v)}
        >
          <SelectTrigger aria-label="Project" className="h-8 w-auto px-3 text-xs">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {loadError ? (
        <p className="max-w-[14rem] text-[11px] text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
    </div>
  )
}
