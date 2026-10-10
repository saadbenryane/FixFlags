import assert from 'node:assert/strict'
import test from 'node:test'
import { validateSkills } from './skill-validator.mjs'

test('the customer skill and IDE integrations match the public workflow', () => {
  assert.deepEqual(validateSkills(), [])
})
