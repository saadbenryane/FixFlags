import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSkills } from './skill-validator.mjs'

test('repository skills have valid structure, links, and durable content', () => {
  assert.deepEqual(validateSkills(), [])
})
