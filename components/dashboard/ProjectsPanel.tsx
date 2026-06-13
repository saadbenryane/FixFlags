'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconInput } from '@/components/ui/icon-input'
import { FolderPlus, Trash2, Tag, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'

interface ProjectRow {
  id: string
  name: string
  url: string
  auditCount: number
}

interface Props {
  plan: Plan
}

export function ProjectsPanel({ plan }: Props) {
  const limit = projectLimitForPlan(plan)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  async function loadProjects() {
    const res = await fetch('/api/projects')
    if (res.ok) {
      setProjects(await res.json())
    }
    setLoading(false)
  }

  useEffect(() => {
    if (limit > 0) {
      loadProjects()
    } else {
      setLoading(false)
    }
  }, [limit])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create project')
        return
      }
      setName('')
      setUrl('')
      await loadProjects()
      toast.success('Project created')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Failed to delete project')
      return
    }
    await loadProjects()
    toast.success('Project deleted')
  }

  if (limit === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="space-y-3 py-5">
          <div>
            <h2 className="text-sm font-medium">Projects</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Organize audits across sites on Team or Studio plans.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Team includes up to 5 projects. Studio includes up to 20.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing">See Team plans</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">Projects</h2>
          <p className="text-xs text-muted-foreground">
            {projects.length} / {limit} used — assign audits from report pages
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading projects...</div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Card key={project.id}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{project.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {project.url} · {project.auditCount} audit{project.auditCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(project.id)}
                  aria-label={`Delete ${project.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {projects.length < limit && (
        <form onSubmit={handleCreate} className="rounded-xl border p-4 bg-muted/20 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            New project
          </p>
          <IconInput
            label="Name"
            icon={<Tag className="h-4 w-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Marketing site"
            required
          />
          <IconInput
            label="Primary URL"
            icon={<Globe className="h-4 w-4" />}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            required
          />
          <Button type="submit" size="sm" disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create project
          </Button>
        </form>
      )}
    </div>
  )
}
