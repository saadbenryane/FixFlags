'use client'

/**
 * PARKED: not mounted on the live Agent|Report shell.
 * Keep for a future Canvas unpark. Do not rewire into ReportWorkspaceSplitShell
 * without an explicit product decision.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Input } from '@/components/ui/input'
import { WorkspacePanel } from '@/components/report/WorkspacePanel'
import type {
  CanvasBlock,
  CanvasDocument,
  CanvasSourceReference,
  CanvasVersionRecord,
  ReportCanvasRecord,
} from '@/lib/canvas/domain'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type CanvasDetail = {
  canvas: ReportCanvasRecord
  current: CanvasVersionRecord | null
}

const copy = REPORT_COPY.workspace.canvas

function SourceLinks({
  auditId,
  sourceRefIds,
  references,
}: {
  auditId: string
  sourceRefIds: string[]
  references: Map<string, CanvasSourceReference>
}) {
  const sources = sourceRefIds.map((id) => references.get(id)).filter(Boolean) as CanvasSourceReference[]
  if (sources.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {sources.map((source) => (
        <Button key={source.id} asChild size="sm" variant="ghost" className="min-h-11">
          <Link
            href={
              source.kind === 'flag'
                ? `/report/${auditId}?flag=${encodeURIComponent(source.entityId)}#report-flags`
                : `/report/${auditId}#report-flags`
            }
          >
            {copy.source}
          </Link>
        </Button>
      ))}
    </div>
  )
}

function CanvasBlockView({
  auditId,
  block,
  references,
}: {
  auditId: string
  block: CanvasBlock
  references: Map<string, CanvasSourceReference>
}) {
  let body: ReactNode
  switch (block.type) {
    case 'score-summary':
      body = (
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="section-label text-muted-foreground">{copy.score}</p>
            <p className="mt-2 text-5xl font-semibold tracking-tight">{block.score}</p>
          </div>
          <p className="max-w-xs text-right text-sm text-muted-foreground">{block.label}</p>
        </div>
      )
      break
    case 'rubric-comparison':
      body = (
        <div className="grid gap-3 sm:grid-cols-3">
          {block.rubrics.map((rubric) => (
            <div key={rubric.rubric} className="rounded-nested-md bg-muted/40 p-3">
              <p className="text-sm font-medium">{rubric.rubric}</p>
              <p className="mt-1 text-2xl font-semibold">{rubric.score ?? copy.scoreUnavailable}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rubric.status.replaceAll('_', ' ')}</p>
            </div>
          ))}
        </div>
      )
      break
    case 'ranked-flags':
    case 'finish-plan':
      body = (
        <div>
          <h3 className="text-xl font-semibold">{block.title}</h3>
          <ol className="mt-3 space-y-2">
            {block.flagIds.map((flagId, index) => (
              <li key={flagId} className="flex items-center justify-between gap-3 rounded-nested-md bg-muted/40 p-3">
                <span className="text-sm font-medium">{index + 1}. Flag</span>
                <Button asChild size="sm" variant="ghost" className="min-h-11">
                  <Link href={`/report/${auditId}?flag=${encodeURIComponent(flagId)}#report-flags`}>
                    {copy.source}
                  </Link>
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )
      break
    case 'evidence-gallery':
      body = (
        <div>
          <h3 className="text-xl font-semibold">{block.title}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {block.items.map((item) => (
              <div key={item.captureRefId} className="rounded-nested-md bg-muted/40 p-4 text-sm">
                {item.caption}
              </div>
            ))}
          </div>
        </div>
      )
      break
    case 'before-after':
      body = (
        <div>
          <h3 className="text-xl font-semibold">{block.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.summary}</p>
        </div>
      )
      break
    case 'product-memory':
      body = (
        <div>
          <h3 className="text-xl font-semibold">{block.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">Verified Product Memory</p>
        </div>
      )
      break
    case 'heading':
      body = block.level === 2
        ? <h2 className="text-2xl font-semibold">{block.text}</h2>
        : <h3 className="text-xl font-semibold">{block.text}</h3>
      break
    case 'text':
      body = <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
      break
    case 'callout':
      body = (
        <Callout variant={block.tone === 'warning' ? 'warning' : block.tone === 'success' ? 'success' : 'info'} title={block.title}>
          {block.text}
        </Callout>
      )
      break
  }

  return (
    <section className="rounded-card bg-card/70 p-4 shadow-card sm:p-5">
      {body}
      <SourceLinks auditId={auditId} sourceRefIds={block.sourceRefIds} references={references} />
    </section>
  )
}

export function ReportCanvasPanel({ auditId }: { auditId: string }) {
  const [canvases, setCanvases] = useState<ReportCanvasRecord[]>([])
  const [detail, setDetail] = useState<CanvasDetail | null>(null)
  const [versions, setVersions] = useState<CanvasVersionRecord[]>([])
  const [title, setTitle] = useState('')
  const [instruction, setInstruction] = useState('')
  const [revision, setRevision] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDetail = useCallback(async (canvasId: string) => {
    const [detailResponse, versionsResponse] = await Promise.all([
      fetch(`/api/reports/${auditId}/canvases/${canvasId}`),
      fetch(`/api/reports/${auditId}/canvases/${canvasId}/versions`),
    ])
    const nextDetail = await detailResponse.json().catch(() => null)
    const nextVersions = await versionsResponse.json().catch(() => null)
    if (!detailResponse.ok || !nextDetail?.canvas) throw new Error(copy.loadFailed)
    setDetail(nextDetail)
    setVersions(versionsResponse.ok && Array.isArray(nextVersions) ? nextVersions : [])
  }, [auditId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/${auditId}/canvases`)
      const data = await response.json().catch(() => null)
      if (!response.ok || !Array.isArray(data)) throw new Error(copy.loadFailed)
      setCanvases(data)
      if (data[0]?.id) await loadDetail(data[0].id)
      else {
        setDetail(null)
        setVersions([])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [auditId, loadDetail])

  useEffect(() => { void load() }, [load])

  async function createCanvas() {
    if (!title.trim() || !instruction.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/${auditId}/canvases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), instruction: instruction.trim() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? copy.saveFailed)
      setTitle('')
      setInstruction('')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  async function updateCanvas(body: { action: 'revise'; instruction: string } | { action: 'restore'; version: number }) {
    if (!detail || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/${auditId}/canvases/${detail.canvas.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? copy.saveFailed)
      setRevision('')
      await loadDetail(detail.canvas.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const references = useMemo(
    () => new Map((detail?.current?.sourceRefs ?? []).map((source) => [source.id, source])),
    [detail],
  )
  const document = detail?.current?.document as CanvasDocument | undefined

  if (loading) return <WorkspacePanel><p role="status" className="text-sm text-muted-foreground">{copy.loading}</p></WorkspacePanel>

  return (
    <WorkspacePanel className="space-y-5">
      {error ? <Callout variant="warning" title={error}><Button className="mt-2 min-h-11" variant="outline" onClick={() => void load()}>{copy.retry}</Button></Callout> : null}
      {canvases.length === 0 ? (
        <div className="mx-auto max-w-xl py-8 text-center">
          <h2 className="text-2xl font-semibold">{copy.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.emptyBody}</p>
          <div className="mx-auto mt-6 max-w-md space-y-3 text-left">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={copy.titlePlaceholder} />
            <textarea
              className="min-h-28 w-full rounded-md bg-background px-3 py-2 text-sm shadow-sm outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-focus-ring"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={copy.instructionPlaceholder}
            />
            <Button className="min-h-11 w-full" disabled={submitting || !title.trim() || !instruction.trim()} onClick={() => void createCanvas()}>
              {copy.create}
            </Button>
          </div>
        </div>
      ) : detail && document ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-label text-muted-foreground">{copy.title}</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">{document.title}</h2>
              {document.summary ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{document.summary}</p> : null}
            </div>
            {canvases.length > 1 ? (
              <select
                aria-label={copy.title}
                className="min-h-11 rounded-md bg-background px-3 text-sm ring-1 ring-border"
                value={detail.canvas.id}
                onChange={(event) => void loadDetail(event.target.value)}
              >
                {canvases.map((canvas) => <option key={canvas.id} value={canvas.id}>{canvas.title}</option>)}
              </select>
            ) : null}
          </div>
          <div className="space-y-3">
            {document.blocks.map((block) => <CanvasBlockView key={block.id} auditId={auditId} block={block} references={references} />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.35fr)]">
            <div className="space-y-3">
              <textarea
                className="min-h-24 w-full rounded-md bg-background px-3 py-2 text-sm shadow-sm outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-focus-ring"
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                placeholder={copy.revisePlaceholder}
              />
              <Button className="min-h-11" disabled={submitting || !revision.trim()} onClick={() => void updateCanvas({ action: 'revise', instruction: revision.trim() })}>
                {copy.revise}
              </Button>
            </div>
            <div>
              <p className="section-label text-muted-foreground">{copy.versions}</p>
              <div className="mt-2 space-y-2">
                {versions.map((version) => (
                  <Button
                    key={version.version}
                    variant="ghost"
                    className={cn('min-h-11 w-full justify-start', version.version === detail.canvas.currentVersion && 'bg-muted')}
                    disabled={submitting || version.version === detail.canvas.currentVersion}
                    onClick={() => void updateCanvas({ action: 'restore', version: version.version })}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
                    {copy.restore(version.version)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Callout variant="warning" title={copy.loadFailed} />
      )}
    </WorkspacePanel>
  )
}
