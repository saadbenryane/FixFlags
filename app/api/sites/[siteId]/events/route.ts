import { requireSiteAccess } from '@/lib/sites/request-access'
import { apiError } from '@/lib/api/errors'
import { decodeEventCursor, encodeEventCursor, readSiteEvents, projectionNoticeSchema } from '@/lib/sites/application/execution-progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) return apiError(access.message, access.status)
  let cursor: bigint
  try { cursor = decodeEventCursor(siteId, request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('after')) }
  catch { return apiError('Invalid Site event cursor', 400) }
  const encoder = new TextEncoder(), until = Date.now() + 50_000
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  let close: (() => void) | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => { if (stopped) return; stopped = true; clearTimeout(timer); request.signal.removeEventListener('abort', close!); controller.close() }
      request.signal.addEventListener('abort', close, { once: true })
      async function tick() {
        if (stopped) return
        try {
          // Recheck permission/session on every bounded read, including revocation.
          const current = await requireSiteAccess(siteId)
          if (stopped) return
          if (!current.ok) { controller.enqueue(encoder.encode('event: access-expired\ndata: {}\n\n')); close!(); return }
          const rows = await readSiteEvents(current.decision.site, cursor)
          for (const row of rows) {
            if (stopped) return
            cursor = row.sequence
            const notice = projectionNoticeSchema.safeParse(row.detail)
            if (!notice.success) continue
            controller.enqueue(encoder.encode('id: ' + encodeEventCursor(siteId, cursor) + '\nevent: projection\ndata: ' +
              JSON.stringify({ auditId: row.auditId, ...notice.data }) + '\n\n'))
          }
          if (Date.now() >= until) { close!(); return }
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
          timer = setTimeout(() => void tick(), rows.length === 100 ? 20 : 2000)
        } catch {
          if (!stopped) { controller.enqueue(encoder.encode('event: disconnected\ndata: {}\n\n')); close!() }
        }
      }
      if (request.signal.aborted) close()
      else void tick()
    },
    cancel() { stopped = true; clearTimeout(timer); if (close) request.signal.removeEventListener('abort', close) },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
