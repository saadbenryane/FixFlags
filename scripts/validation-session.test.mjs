import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runValidationSession } from './validation-session.mjs'
function fixture() {
  const events = []
  return { events, options: { names: ['Validation-Web'], inspect: async () => ({ 'Validation-Web': { running: false }, 'Redis-ie4W': { running: false } }),
    dependencies: async name => name === 'Validation-Web' ? ['Redis-ie4W'] : [],
    start: async name => events.push('start:' + name), stop: async name => events.push('stop:' + name), command: async () => 0 } }
}
test('starts only required dependencies and stops them in reverse order', async () => {
  const { events, options } = fixture()
  assert.equal(await runValidationSession(options), 0)
  assert.deepEqual(events, ['start:Redis-ie4W', 'start:Validation-Web', 'stop:Validation-Web', 'stop:Redis-ie4W'])
})
test('cleans up after command or startup failure', async () => {
  for (const failure of ['command', 'start']) {
    const { events, options } = fixture()
    options[failure] = async () => { throw new Error('fixture failure') }
    await assert.rejects(runValidationSession(options), /fixture failure/)
    assert.ok(events.some(value => value.startsWith('stop:')))
  }
})
test('refuses production dependencies and services already owned by another session', async () => {
  const { options } = fixture()
  await assert.rejects(runValidationSession({ ...options, dependencies: async () => ['Postgres'] }), /external service/)
  await assert.rejects(runValidationSession({ ...options, inspect: async () => ({ 'Validation-Web': { running: true } }) }), /already running/)
})
