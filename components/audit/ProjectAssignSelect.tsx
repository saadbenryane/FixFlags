'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

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
        const data = await res.json()
        toast.error(data.error || 'Failed to assign project')
        setProjectId(initialProjectId ?? '')
        return
      }
      toast.success(nextId ? 'Assigned to project' : 'Removed from project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Project</span>
      <select
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
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
