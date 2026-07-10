'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  auditId: string
  initialProjectId?: string | null
  enabled: boolean
}

export function ProjectAssignSelect({ auditId, initialProjectId, enabled }: Props) {
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
    setProjectId(nextId)
    setSaving(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/project`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: nextId || null }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        setProjectId(initialProjectId ?? '')
        return
      }
      toast.success(nextId ? 'Assigned to project' : 'Removed from project')
    } catch {
      toast.error('Could not update the project. Try again.')
      setProjectId(initialProjectId ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Project</span>
      <select
        className="rounded-full border-0 bg-[var(--glass-bg-subtle)] px-3 py-1.5 text-sm shadow-glass backdrop-blur-md"
        value={projectId}
        disabled={saving || projects.length === 0}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">None</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}
