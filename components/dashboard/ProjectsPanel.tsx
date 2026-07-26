'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { Surface } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionTitle } from '@/components/ui/typography'
import { IconInput } from '@/components/ui/icon-input'
import { FolderPlus, Trash2, Tag, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { ProjectScanAccessPanel } from '@/components/settings/ProjectScanAccessPanel'

interface ProjectRow {
  id: string
  name: string
  url: string
  auditCount: number
}

interface Props {
  plan: Plan
  initialProjects: ProjectRow[]
}

export function ProjectsPanel({ plan, initialProjects }: Props) {
  const limit = projectLimitForPlan(plan)
  const { confirm, confirmDialog } = useConfirm()
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
      })
      if (!res.ok) {
        const error = await parseApiErrorResponse(res)
        setFormError(error.message)
        return
      }
      const project = (await res.json()) as { id: string; name: string; url: string }
      setProjects((current) => [
        { id: project.id, name: project.name, url: project.url, auditCount: 0 },
        ...current.filter((item) => item.id !== project.id),
      ])
      setName('')
      setUrl('')
      toast.success('Project created')
    } catch {
      setFormError('Could not create the project. Check your connection and try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(project: ProjectRow) {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description: 'Its audits will remain available.',
      confirmLabel: 'Delete project',
      destructive: true,
    })
    if (!ok) return
    setDeletingId(project.id)
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await parseApiErrorResponse(res)
        toast.error(error.message)
        return
      }
      setProjects((current) => current.filter((item) => item.id !== project.id))
      toast.success('Project deleted')
    } catch {
      toast.error('Could not delete the project. Try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (limit === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-5">
          <div>
            <SectionTitle>Projects</SectionTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Organize audits across sites on the Agency plan.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Agency includes up to 5 projects.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing">See Agency plans</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex items-center justify-between gap-4">
        <div>
        <SectionTitle>Projects</SectionTitle>
          <p className="text-xs text-muted-foreground">
            {projects.length} / {limit} used, assign audits from report pages
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create one to group audits for the same site."
        />
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <div key={project.id} className="space-y-3">
              <Card>
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
                    onClick={() => handleDelete(project)}
                    disabled={deletingId === project.id}
                    aria-label={`Delete ${project.name}`}
                  >
                    {deletingId === project.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </CardContent>
              </Card>
              <ProjectScanAccessPanel projectId={project.id} projectUrl={project.url} />
            </div>
          ))}
        </div>
      )}

      {projects.length < limit && (
        <form onSubmit={handleCreate} className="space-y-3">
          <Surface variant="nested" className="space-y-3">
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
            autoComplete="organization"
            required
          />
          <IconInput
            label="Primary URL"
            icon={<Globe className="h-4 w-4" />}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
          />
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <Button type="submit" size="sm" disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create project
          </Button>
          </Surface>
        </form>
      )}
    </div>
  )
}
