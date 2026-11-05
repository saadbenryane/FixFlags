import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { markReadByAgent, markReadByVisitor } from '../messages'
import { appendSupportMessage } from '../ordered-messages'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('support read cursor PostgreSQL ownership', () => {
  let tenantId = ''
  let sessionId = ''
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !database.pathname.startsWith('/fixflags_execution_test_'))
      throw new Error('Support cursor verification requires a disposable local execution database')
    const suffix = randomUUID()
    const tenant = await prisma.supportTenant.create({ data: { slug: `cursor-${suffix}`, name: 'Cursor fixture' } })
    tenantId = tenant.id
    const session = await prisma.supportSession.create({ data: { tenantId, visitorToken: `visitor-${suffix}`, status: 'ACTIVE' } })
    sessionId = session.id
  })
  afterEach(async () => {
    if (tenantId) await prisma.supportTenant.delete({ where: { id: tenantId } })
    tenantId = ''; sessionId = ''
  })
  afterAll(async () => { await prisma.$disconnect() })

  async function append(role: 'AGENT' | 'VISITOR') {
    return prisma.$transaction(async tx => {
      const message = await appendSupportMessage(tx, { sessionId, role, body: `Recorded ${role} message` })
      await tx.supportSession.update({ where: { id: sessionId }, data: role === 'AGENT'
        ? { unreadByVisitor: { increment: 1 } } : { unreadByAgent: { increment: 1 } } })
      return message
    })
  }

  it.each(['visitor', 'agent'] as const)('preserves unseen incoming messages and monotonic %s read progress', async reader => {
    const incoming = reader === 'visitor' ? 'AGENT' : 'VISITOR'
    const outgoing = reader === 'visitor' ? 'VISITOR' : 'AGENT'
    const markRead = reader === 'visitor' ? markReadByVisitor : markReadByAgent
    const first = await append(incoming)
    await append(outgoing)
    const next = await append(incoming)
    await markRead(sessionId, first.sequence)
    let state = await prisma.supportSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(reader === 'visitor' ? state.unreadByVisitor : state.unreadByAgent).toBe(1)
    expect(reader === 'visitor' ? state.visitorReadThrough : state.agentReadThrough).toBe(first.sequence)

    const [, concurrent] = await Promise.all([markRead(sessionId, next.sequence), append(incoming)])
    await markRead(sessionId, first.sequence)
    state = await prisma.supportSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(reader === 'visitor' ? state.unreadByVisitor : state.unreadByAgent).toBe(1)
    expect(reader === 'visitor' ? state.visitorReadThrough : state.agentReadThrough).toBe(next.sequence)
    expect(concurrent.sequence).toBeGreaterThan(next.sequence)
    await markRead(sessionId, concurrent.sequence)
    state = await prisma.supportSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(reader === 'visitor' ? state.unreadByVisitor : state.unreadByAgent).toBe(0)
  })

  it.each(['visitor', 'agent'] as const)('rejects unrecorded %s cursors without changing unread messages', async reader => {
    await append(reader === 'visitor' ? 'AGENT' : 'VISITOR')
    const markRead = reader === 'visitor' ? markReadByVisitor : markReadByAgent
    for (const through of [BigInt(-1), BigInt(2)]) {
      await expect(markRead(sessionId, through)).rejects.toMatchObject({ code: 'INVALID_CURSOR' })
    }
    const state = await prisma.supportSession.findUniqueOrThrow({ where: { id: sessionId } })
    expect(reader === 'visitor' ? state.unreadByVisitor : state.unreadByAgent).toBe(1)
    expect(reader === 'visitor' ? state.visitorReadThrough : state.agentReadThrough).toBe(BigInt(0))
  })
})
