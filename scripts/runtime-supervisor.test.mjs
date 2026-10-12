import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createSupervisor } from './runtime-supervisor.mjs'

const alive = pid => { try { process.kill(pid, 0); return true } catch { return false } }
async function eventually(check) { for (let n=0; n<100; n++) { if (await check()) return; await delay(20) } throw new Error('Condition did not settle') }

test('stopping during preflight prevents subsequent launches and waits for cleanup', async () => {
  const supervisor = createSupervisor({ env: process.env, shutdownMs: 1000, log() {} })
  const doctor = supervisor.launch(['-e', 'setInterval(()=>{},1000)'], { role: 'doctor', transient: true })
  assert.equal(await supervisor.shutdown(), true)
  await doctor.done
  assert.equal(alive(doctor.child.pid), false)
  assert.throws(() => supervisor.launch(['-e','process.exit(0)'], { role: 'web' }), /stopping/)
})
test('unexpected child exit shuts down its companion', async () => {
  let failure, stopped
  const supervisor = createSupervisor({ env: process.env, shutdownMs: 1000, log() {}, onFailure: code => { failure = code; stopped = supervisor.shutdown() } })
  const companion = supervisor.launch(['-e', 'setInterval(()=>{},1000)'], { role: 'worker' })
  const failed = supervisor.launch(['-e', 'process.exit(7)'], { role: 'web' })
  await failed.done
  await stopped
  assert.equal(failure, 7)
  assert.equal(alive(companion.child.pid), false)
})
test('cleans descendants left behind by an exited wrapper', { skip: process.platform === 'win32' }, async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'ff-supervisor-')), file = join(cwd, 'child.json')
  const supervisor = createSupervisor({ env: process.env, shutdownMs: 1000, log() {} })
  const code = `const {spawn}=require('node:child_process');const fs=require('node:fs');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(${JSON.stringify(file)},JSON.stringify(c.pid));setTimeout(()=>process.exit(0),100)`
  const wrapper = supervisor.launch(['-e', code], { role: 'doctor', transient: true })
  try {
    await eventually(async () => { try { await readFile(file); return true } catch { return false } })
    const pid = JSON.parse(await readFile(file,'utf8'))
    await wrapper.done
    await supervisor.shutdown()
    await eventually(() => !alive(pid))
  } finally { await supervisor.shutdown(); await rm(cwd,{recursive:true,force:true}) }
})
