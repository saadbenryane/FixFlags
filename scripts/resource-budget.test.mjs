import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startMemorySampler } from '../lib/runtime/memory-sampler.mjs'
import { budgetDatabaseUrl } from '../lib/runtime/database-budget.mjs'

test('connection budgets preserve credentials, private networking and smaller pools', () => {
  const source = 'postgresql://name:secret@db.railway.internal:5432/app?sslmode=require'
  for (const [role, limit] of [['web', '5'], ['worker', '10']]) {
    const url = new URL(budgetDatabaseUrl(source, role))
    assert.equal(url.searchParams.get('connection_limit'), limit)
    assert.equal(url.searchParams.get('pool_timeout'), '10')
    assert.equal(url.hostname, 'db.railway.internal'); assert.equal(url.password, 'secret')
    assert.equal(url.searchParams.get('sslmode'), 'require')
  }
  assert.equal(new URL(budgetDatabaseUrl(source + '&connection_limit=2&pool_timeout=20')).searchParams.get('connection_limit'), '2')
  assert.equal(new URL(budgetDatabaseUrl(source + '&pool_timeout=20')).searchParams.get('pool_timeout'), '20')
})
test('memory samples expose only fixed numeric fields and stop cleanly', async () => {
  const samples = []
  const observer = startMemorySampler({ role: 'worker', memoryUsage: () => ({ rss: 20, heapUsed: 10, heapTotal: 15, external: 2, arrayBuffers: 1 }),
    readContainer: async () => 30, readCounts: async () => ({ activeTasks: 2, browserContexts: 1, secret: 'never log' }), emit: sample => samples.push(sample) })
  await new Promise(resolve => setImmediate(resolve)); observer.stop()
  assert.equal(samples.length, 1); assert.equal(samples[0].heapUsedBytes, 10)
  assert.equal(samples[0].activeTasks, 2); assert.equal(samples[0].containerBytes, 30)
  assert.equal(JSON.stringify(samples).includes('secret'), false)
})
test('pending memory sampling cannot publish after shutdown', async () => {
  let release
  const sample = new Promise(resolve => { release = resolve }), samples = []
  const observer = startMemorySampler({ role: 'worker', readContainer: () => sample, emit: value => samples.push(value) })
  observer.stop(); release(10); await new Promise(resolve => setImmediate(resolve))
  assert.equal(samples.length, 0)
})
