import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const audit = await prisma.audit.findUnique({
    where: { id },
    include: {
      areas: {
        include: {
          findings: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      },
      screenshots: true,
    },
  })

  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
  }

  return NextResponse.json(audit)
}
