#!/usr/bin/env node

import { strict as assert } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Queue, QueueEvents, Worker } from 'bullmq'
import { config } from 'dotenv'
import IORedis from 'ioredis'

config({ path: '.env.local', override: false })
config({ override: false })

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the recovery evaluation')
if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the recovery evaluation')

const queueName = `fixflags-eval-${randomUUID()}`
const connection = () => new IORedis(process.env.REDIS_URL, {
  family: 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})
const queueConnection = connection()
const eventsConnection = connection()
const workerConnection = connection()
const queue = new Queue(queueName, { connection: queueConnection })
const events = new QueueEvents(queueName, { connection: eventsConnection })
const prisma = new PrismaClient()
let attempts = 0
const worker = new Worker(queueName, async (job) => {
  attempts += 1
  if (job.name === 'retry-once' && job.attemptsMade === 0) throw new Error('intentional first-attempt crash')
  return { accepted: job.data.value }
}, { connection: workerConnection })

try {
  await prisma.$queryRaw`SELECT 1`
  await events.waitUntilReady()
  await worker.waitUntilReady()

  const success = await queue.add('success', { value: 'first' }, { jobId: 'idempotent-job' })
  assert.deepEqual(await success.waitUntilFinished(events, 20_000), { accepted: 'first' })

  const duplicate = await queue.add('success', { value: 'ignored' }, { jobId: 'idempotent-job' })
  assert.equal(duplicate.id, success.id, 'duplicate submission must reuse the existing job')

  const retried = await queue.add('retry-once', { value: 'recovered' }, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10 },
  })
  assert.deepEqual(await retried.waitUntilFinished(events, 20_000), { accepted: 'recovered' })
  assert.equal(attempts, 3, 'one success plus a failed and recovered attempt should execute')

  console.log('Runtime recovery evaluation passed: PostgreSQL reachable, Redis queue processed, retry recovered, duplicate job stayed idempotent.')
} finally {
  await worker.close()
  await events.close()
  await queue.obliterate({ force: true }).catch(() => undefined)
  await queue.close()
  await prisma.$disconnect()
  queueConnection.disconnect()
  eventsConnection.disconnect()
  workerConnection.disconnect()
}
