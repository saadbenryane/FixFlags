import assert from 'node:assert/strict'
import test from 'node:test'
import { collectRouteContracts, validateRouteContracts } from './route-contract-registry.mjs'

test('every API route is represented by a valid generated contract', () => {
  const contracts = collectRouteContracts()
  assert.ok(contracts.length > 0)
  assert.deepEqual(validateRouteContracts(contracts), [])
  assert.equal(new Set(contracts.map(({ file }) => file)).size, contracts.length)
  assert.ok(contracts.every(({ evidence }) => evidence.length > 0))
})

test('readiness is public and dependency-aware', () => {
  const readiness = collectRouteContracts().find(({ file }) => file === 'app/api/health/ready/route.ts')
  assert.deepEqual(readiness?.methods, ['GET'])
  assert.equal(readiness?.boundary, 'public')
  assert.ok(readiness?.cases.includes('dependency-failure'))
})

test('protected mutations include access and input contracts', () => {
  const contracts = collectRouteContracts().filter(({ boundary, methods }) => !['public', 'parked'].includes(boundary) && methods.some((method) => method !== 'GET'))
  assert.ok(contracts.length > 0)
  for (const contract of contracts) {
    assert.ok(contract.cases.includes('unauthenticated'), contract.file)
    assert.ok(contract.cases.includes('invalid-input'), contract.file)
  }
})

test('parked power-tool routes expose only the not-found contract', () => {
  const parked = collectRouteContracts().filter(({ boundary }) => boundary === 'parked')
  assert.ok(parked.length > 0)
  assert.ok(parked.every(({ cases }) => JSON.stringify(cases) === JSON.stringify(['not-found'])))
})

test('secret and webhook boundaries declare validation and retry contracts', () => {
  const contracts = collectRouteContracts()
  const secret = contracts.filter(({ boundary }) => boundary === 'secret')
  const webhooks = contracts.filter(({ boundary }) => boundary === 'webhook')
  assert.ok(secret.length > 0)
  assert.ok(webhooks.length > 0)
  assert.ok(secret.every(({ cases }) => cases.includes('secret-validation')))
  assert.ok(webhooks.every(({ cases }) => cases.includes('signature-validation')))
  assert.ok(webhooks.every(({ cases }) => cases.includes('idempotent-retry')))
})

test('high-risk routes point to handler or credentialed journey evidence', () => {
  const highRisk = collectRouteContracts().filter(({ file }) =>
    /auth|github|reports|stripe|support|cron|health|tools|screenshots|repo-scans/.test(file)
  )
  assert.ok(highRisk.length > 0)
  for (const contract of highRisk) {
    assert.ok(
      contract.evidence.some(({ kind }) =>
        ['handler-test', 'journey-e2e', 'boundary-e2e'].includes(kind)
      ),
      contract.file
    )
  }
})
