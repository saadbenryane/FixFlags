import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { authorizeAdminExport, adminExportChunks } from '@/lib/admin/exports'
import { adminPrivateHeaders } from '@/lib/admin/http'
import { handleRouteError } from '@/lib/api/errors'
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const operation = await authorizeAdminExport(actor, (await params).id),
      chunks = adminExportChunks(operation),
      encoder = new TextEncoder()
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const next = await chunks.next()
          if (next.done) controller.close()
          else controller.enqueue(encoder.encode(next.value))
        } catch (error) {
          controller.error(error)
        }
      },
      async cancel() {
        await chunks.return(undefined)
      },
    })
    const csv = operation.targetId === 'waitlist'
    return new NextResponse(stream, {
      headers: {
        ...adminPrivateHeaders,
        'Content-Type': csv ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="fixflags-${csv ? 'waitlist.csv' : 'feedback.md'}"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
