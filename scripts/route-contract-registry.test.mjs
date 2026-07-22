import assert from 'node:assert/strict'
import test from 'node:test'
import { collectRouteContracts, validateRouteContracts } from './route-contract-registry.mjs'

test('every API route is represented by a valid generated contract', () => {
  const contracts = collectRouteContracts()
  assert.ok(contracts.length > 0)
  assert.deepEqual(validateRouteContracts(contracts), [])
  assert.equal(new Set(contracts.map(({ file }) => file)).size, contracts.length)
})

test('readiness is public and dependency-aware', () => {
  const readiness = collectRouteContracts().find(({ file }) => file === 'app/api/health/ready/route.ts')
  assert.deepEqual(readiness?.methods, ['GET'])
  assert.equal(readiness?.boundary, 'public')
  assert.ok(readiness?.cases.includes('dependency-failure'))
})

test('protected mutations include access and input contracts', () => {
  const contracts = collectRouteContracts().filter(({ boundary, methods }) => boundary !== 'public' && methods.some((method) => method !== 'GET'))
  assert.ok(contracts.length > 0)
  for (const contract of contracts) {
    assert.ok(contract.cases.includes('unauthenticated'), contract.file)
    assert.ok(contract.cases.includes('invalid-input'), contract.file)
  }
})
