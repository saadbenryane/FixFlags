import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRuntimeControl, requestRuntimeControl, readRuntimeState, runtimeStatePath } from './local-runtime-control.mjs'

test('authenticates local stop, refuses mismatched identity, and cleans private metadata', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'ff-control-'))
  let stops = 0
  const control = await createRuntimeControl({ cwd, status: () => ({ phase: 'ready' }), stop: () => { stops++ } })
  try {
    assert.equal((await stat(runtimeStatePath(cwd))).mode & 0o777, 0o600)
    assert.equal((await stat(control.state.socket)).mode & 0o777, 0o600)
    await assert.rejects(requestRuntimeControl({ ...control.state, token: 'wrong' }, 'stop'), /ownership/)
    await assert.rejects(requestRuntimeControl({ ...control.state, runtimeId: 'wrong' }, 'stop'), /ownership/)
    assert.equal(stops, 0)
    assert.equal((await requestRuntimeControl(control.state, 'status')).phase, 'ready')
    await requestRuntimeControl(control.state, 'stop')
    assert.equal(stops, 1)
    await assert.rejects(createRuntimeControl({ cwd, status: () => ({}), stop: () => {} }), /already has/)
  } finally { await control.close(); await rm(cwd, { recursive: true, force: true }) }
})
test('stale metadata cannot authorize a stop or signal a recorded PID', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'ff-control-'))
  const control = await createRuntimeControl({ cwd, status: () => ({}), stop: () => {} })
  const stale = control.state
  await control.close()
  try {
    await writeFile(runtimeStatePath(cwd), JSON.stringify(stale), { mode: 0o600 })
    await assert.rejects(requestRuntimeControl(await readRuntimeState(cwd), 'stop'))
    const replacement = await createRuntimeControl({ cwd, status: () => ({}), stop: () => {} })
    assert.notEqual(replacement.state.token, stale.token)
    await replacement.close()
  } finally { await rm(cwd, { recursive: true, force: true }) }
})

test('simultaneous starters publish only one authenticated supervisor', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'ff-control-race-'))
  const results = await Promise.allSettled(Array.from({length: 4}, () => createRuntimeControl({ cwd, status: () => ({}), stop: () => {} })))
  const winners = results.filter(r => r.status === 'fulfilled')
  try {
    assert.equal(winners.length, 1)
    const recorded = await readRuntimeState(cwd)
    assert.equal((await requestRuntimeControl(recorded, 'status')).runtimeId, winners[0].value.state.runtimeId)
  } finally {
    await Promise.all(winners.map(r => r.value.close()))
    await rm(cwd, {recursive:true, force:true})
  }
})
