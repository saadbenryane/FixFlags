import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { isAutoPatchable } from '@/lib/repo-scan/auto-patch-policy'

describe('isAutoPatchable', () => {
  it('is true for an exposed secret in a .env file', () => {
    assert.equal(isAutoPatchable({ category: 'Exposed secret', filePath: '.env' }), true)
  })

  it('is true for an exposed secret in a nested .env.production file', () => {
    assert.equal(
      isAutoPatchable({ category: 'Exposed secret', filePath: 'apps/web/.env.production' }),
      true
    )
  })

  it('is false for an exposed secret in a non-.env file', () => {
    assert.equal(
      isAutoPatchable({ category: 'Exposed secret', filePath: 'src/config.ts' }),
      false
    )
  })

  it('is false for a .env-adjacent filename that is not actually an env file', () => {
    assert.equal(
      isAutoPatchable({ category: 'Exposed secret', filePath: 'src/environment.ts' }),
      false
    )
  })

  it('is false for a non-secret category even in a .env file', () => {
    assert.equal(
      isAutoPatchable({ category: 'Dependency hygiene', filePath: '.env' }),
      false
    )
  })
})
