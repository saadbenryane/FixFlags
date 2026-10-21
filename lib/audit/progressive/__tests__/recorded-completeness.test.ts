import { describe, expect, it } from 'vitest'
import { recordedWorkComplete, type RecordedCompletionTask } from '../recorded-completeness'

function graph(): RecordedCompletionTask[] {
  return [
    { targetKey: 'task:http', workKind: 'http', workState: 'COMPLETED', status: 'COMPLETED', workDependencies: [] },
    { targetKey: 'task:check', workKind: 'check', workState: 'COMPLETED', status: 'COMPLETED', workDependencies: ['http'] },
    { targetKey: 'task:finalize', workKind: 'finalize', workState: 'COMPLETED', status: 'COMPLETED', workDependencies: ['check'] },
  ]
}
describe('recorded work completeness', () => {
  it('follows committed dependencies independently of current planner output and row order', () => {
    expect(recordedWorkComplete(graph().reverse())).toBe(true)
    expect(recordedWorkComplete([...graph(), { targetKey: 'module:receipt', status: 'COMPLETED' },
      { targetKey: 'task:prescription', workKind: 'prescription', status: 'FAILED', workState: 'EXHAUSTED' }])).toBe(true)
  })
  it.each(['READY', 'RUNNING', 'RETRY_WAIT', 'BLOCKED', 'EXHAUSTED'])('retains a %s obligation as incomplete', state => {
    const tasks = graph(); tasks[0].workState = state
    expect(recordedWorkComplete(tasks)).toBe(false)
  })
  it('accepts a settled recorded exclusion but rejects unfinished exclusions and contradictory success', () => {
    const tasks = graph(); tasks[0].status = 'NOT_APPLICABLE'; tasks[0].workState = 'EXHAUSTED'
    expect(recordedWorkComplete(tasks)).toBe(true)
    tasks[0].workState = 'RUNNING'
    expect(recordedWorkComplete(tasks)).toBe(false)
    tasks[0].status = 'FAILED'; tasks[0].workState = 'COMPLETED'
    expect(recordedWorkComplete(tasks)).toBe(false)
  })
  it('rejects missing manifests, missing dependencies, duplicates, cycles and orphaned obligations', () => {
    expect(recordedWorkComplete([])).toBe(false)
    expect(recordedWorkComplete(graph().slice(0, 2))).toBe(false)
    expect(recordedWorkComplete(graph().slice(1))).toBe(false)
    const tasks = graph(); tasks[2].workDependencies = undefined
    expect(recordedWorkComplete(tasks)).toBe(false)
    expect(recordedWorkComplete([...graph(), graph()[0]])).toBe(false)
    const cyclic = graph(); cyclic[0].workDependencies = ['check']
    expect(recordedWorkComplete(cyclic)).toBe(false)
    expect(recordedWorkComplete([...graph(), { ...graph()[0], targetKey: 'task:orphan' }])).toBe(false)
  })
})
