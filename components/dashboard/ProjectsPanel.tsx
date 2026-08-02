'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionTitle } from '@/components/ui/typography'
import { IconInput } from '@/components/ui/icon-input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ChevronDown,
  FolderPlus,
  FolderSync,
  Loader2,
  Tag,
  Trash2,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import { projectLimitForPlan } from '@/lib/billing/plans'
import { Plan } from '@prisma/client'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { URL_PLACEHOLDER } from '@/lib/marketing/copy'
import { useConfirm } from '@/components/ui/confirm-dialog'
import { ProjectScanAccessPanel } from '@/components/settings/ProjectScanAccessPanel'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'

interface ProjectRow {
  id: string
  name: string
  url: string
  auditCount: number
}

function filePathToSegments(file: File): string[] {
  const relativePath = file.webkitRelativePath || file.name
  return relativePath.replace(/\\/g, '/').split('/')
}

function asDirectoryName(files: File[]): string {
  if (files.length === 0) return 'Selected folder'
  return filePathToSegments(files[0])[0] || 'Selected folder'
}

function normalizeCandidateUrl(candidate: string): string | null {
  const trimmed = candidate.trim()
  if (!trimmed) return null

  const cleaned = trimmed.replace(/^git\+/, '')

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
    try {
      const parsed = new URL(cleaned)
      if (parsed.protocol === 'ssh:' && parsed.hostname) {
        return `https://${parsed.hostname}${parsed.pathname}`
      }
      if (parsed.protocol === 'file:') return null
      return parsed.toString().replace(/\/$/, '')
    } catch {
      // continue below for non-standard formats
    }
  }

  const scpMatch = cleaned.match(/^([^@\s]+)@([^:]+):(.+)$/)
  if (scpMatch) {
    const path = scpMatch[3].replace(/\.git$/i, '').replace(/\/$/, '')
    return `https://${scpMatch[2]}/${path}`
  }

  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+(?:\/.+)?$/.test(cleaned)) {
    return `https://${cleaned.replace(/\/$/, '')}`
  }

  return null
}

function extractOriginFromGitConfig(text: string): string | null {
  const match = text.match(/remote\s+"origin"[\s\S]*?\n\s*url\s*=\s*([^\r\n]+)/i)
  if (!match || !match[1]) return null
  return normalizeCandidateUrl(match[1])
}

async function inferFolderSessionUrl(files: File[]): Promise<string | null> {
  const gitConfig = files.find((file) => {
    const segments = filePathToSegments(file)
    return segments.includes('.git') && segments.at(-1) === 'config'
  })
  if (gitConfig) {
    const raw = await gitConfig.text()
    const parsed = extractOriginFromGitConfig(raw)
    if (parsed) return parsed
  }

  const packageFile = files.find((file) => {
    const segments = filePathToSegments(file)
    return segments.at(-1) === 'package.json'
  })
  if (packageFile) {
    try {
      const raw = await packageFile.text()
      const parsed = JSON.parse(raw)
      if (typeof parsed.homepage === 'string') {
        const url = normalizeCandidateUrl(parsed.homepage)
        if (url) return url
      }
    } catch {
      // ignore malformed package files
    }
  }

  const cnameFile = files.find((file) => {
    const segments = filePathToSegments(file)
    return segments.at(-1) === 'CNAME'
  })
  if (cnameFile) {
    const raw = (await cnameFile.text()).trim()
    const url = normalizeCandidateUrl(raw)
    if (url) return url
  }

  const indexFiles = files.filter((file) => {
    const segments = filePathToSegments(file)
    const name = segments.at(-1) ?? ''
    return name === 'index.html' || name === 'index.htm'
  })
  for (const indexFile of indexFiles) {
    const html = await indexFile.text()
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    if (canonicalMatch?.[1]) {
      const url = normalizeCandidateUrl(canonicalMatch[1])
      if (url) return url
    }
  }

  return null
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
  const [startingSession, setStartingSession] = useState<string | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute('directory', '')
    input.setAttribute('webkitdirectory', '')
  }, [])

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

  async function startSession(urlToScan: string, marker?: string) {
    const candidate = normalizeCandidateUrl(urlToScan)
    if (!candidate) {
      toast.error('Could not resolve a valid URL for this session.')
      return
    }

    try {
      setStartingSession(marker ?? candidate)
      const result = await startScanWithHandoff({
        url: candidate,
        body: {
          url: candidate,
          source: 'dashboard',
        },
      })
      if (!result.ok) {
        toast.error(result.message)
      }
    } catch {
      toast.error('Could not start this session. Please try again.')
    } finally {
      setStartingSession(null)
    }
  }

  async function startSessionFromProject(project: ProjectRow) {
    await startSession(project.url, project.id)
  }

  function openFolderPicker() {
    const input = folderInputRef.current
    if (!input) return
    input.click()
  }

  async function handleFolderSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    setFolderBusy(true)
    const folderName = asDirectoryName(files)
    try {
      const inferredUrl = await inferFolderSessionUrl(files)
      if (!inferredUrl) {
        toast.error(`Could not infer a URL from ${folderName}. Link a directory with a homepage or repository config first.`)
        return
      }
      await startSession(inferredUrl, `folder:${folderName}`)
    } catch {
      toast.error(`Could not start a session from ${folderName}.`)
    } finally {
      setFolderBusy(false)
      if (folderInputRef.current) folderInputRef.current.value = ''
      setStartingSession(null)
    }
  }

  async function handleDelete(project: ProjectRow) {
    const ok = await confirm({
      title: `Delete "${project.name}"?`,
      description: 'Its reports will remain available.',
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
              Organize reports across sites on the Studio plan.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Studio includes up to 5 projects.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/pricing">See Studio plans</Link>
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
            {projects.length} / {limit} used. Assign reports from their report pages.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={startingSession !== null || folderBusy}
            >
              {startingSession || folderBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="mr-2 h-4 w-4" />
              )}
              Start session
              <ChevronDown className="ml-2 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72" sideOffset={6}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Linked directories
            </div>
            {projects.length === 0 ? (
              <DropdownMenuItem disabled>No linked directories yet</DropdownMenuItem>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={() => void startSessionFromProject(project)}
                  disabled={startingSession !== null || folderBusy}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.url}</p>
                  </div>
                  {startingSession === project.id ? (
                    <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void openFolderPicker()}
              disabled={startingSession !== null || folderBusy}
            >
              <FolderSync className="mr-2 h-4 w-4" />
              {folderBusy ? 'Starting from folder…' : 'Start from local folder'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        multiple
        onChange={(event) => void handleFolderSelection(event)}
        className="sr-only"
        aria-label="Select local folder"
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to group reports for the same site."
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
                      {project.url} · {project.auditCount} report{project.auditCount !== 1 ? 's' : ''}
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
            placeholder={URL_PLACEHOLDER}
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
          <Button
            type="submit"
            size="sm"
            loading={creating}
            loadingLabel="Creating project…"
          >
            Create project
          </Button>
          </Surface>
        </form>
      )}
    </div>
  )
}
