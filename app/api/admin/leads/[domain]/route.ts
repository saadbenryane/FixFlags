import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { LeadStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'

const patchSchema = z.object({
  status: z.enum(['NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED']).optional(),
  notes: z.string().max(10000).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { domain: encoded } = await params
    const normalizedDomain = decodeURIComponent(encoded)
    const body = await req.json().catch(() => ({}))
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Invalid request', 400)
    }

    const lead = await prisma.lead.findUnique({ where: { normalizedDomain } })
    if (!lead) return apiError('Lead not found', 404)

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        ...(parsed.data.status ? { status: parsed.data.status as LeadStatus } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    return handleRouteError(err)
  }
}
