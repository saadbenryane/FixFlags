import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const { id } = await params
    const scan = await prisma.repoScan.findUnique({
      where: { id },
      include: {
        findings: {
          orderBy: [{ severity: 'asc' }, { filePath: 'asc' }],
          include: {
            fixPr: {
              select: {
                id: true,
                status: true,
                prNumber: true,
                prUrl: true,
                patchApplied: true,
                errorMsg: true,
              },
            },
          },
        },
      },
    })
    if (!scan || scan.userId !== session.user.id) {
      return apiError('Repo scan not found', 404, { code: 'NOT_FOUND' })
    }

    return NextResponse.json({ scan })
  } catch (err) {
    return handleRouteError(err, 'Failed to load repo scan')
  }
}
