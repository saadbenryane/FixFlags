import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, key: true, lastUsed: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // Mask keys — only show last 4 chars
  return NextResponse.json(
    keys.map((k) => ({ ...k, key: `qos_live_...${k.key.slice(-4)}` }))
  )
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.plan === 'FREE') {
    return NextResponse.json({ error: 'API keys require Builder plan or higher' }, { status: 402 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : 'Default'

  const key = `qos_live_${randomBytes(32).toString('hex')}`

  const apiKey = await prisma.apiKey.create({
    data: { userId: session.user.id, name, key },
  })

  return NextResponse.json({ id: apiKey.id, name: apiKey.name, key })
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await prisma.apiKey.deleteMany({
    where: { id, userId: session.user.id },
  })

  return NextResponse.json({ ok: true })
}
