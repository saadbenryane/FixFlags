'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
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

  useEffect(() => {
    if (!enabled) return
    fetch('/api/projects')
      .then((res) => (res.ok ? res.json() : []))
      .then(setProjects)
      .catch(() => {})
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
      toast.success(resolvedId ? 'Assigned to project' : 'Removed from project')
    } catch {
      toast.error('Could not update the project. Try again.')
      setProjectId(initialProjectId ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className={compact ? 'sr-only' : 'text-muted-foreground'}>Project</span>
      <Select
        value={projectId}
        disabled={saving || projects.length === 0}
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
  )
}
