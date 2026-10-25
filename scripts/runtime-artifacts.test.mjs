import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, copyFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { runtimeEntry } from './runtime-artifacts.mjs'

function isolatedStartup(cwd) {
  mkdirSync(join(cwd,'scripts'),{recursive:true})
  mkdirSync(join(cwd,'lib/runtime'),{recursive:true})
  mkdirSync(join(cwd,'node_modules/@next'),{recursive:true})
  for (const name of ['runtime-start.mjs','runtime-artifacts.mjs']) copyFileSync(new URL(name,import.meta.url),join(cwd,'scripts',name))
  copyFileSync(new URL('../lib/runtime/environment.mjs',import.meta.url),join(cwd,'lib/runtime/environment.mjs'))
  copyFileSync(new URL('../lib/runtime/migration-coordination.mjs',import.meta.url),join(cwd,'lib/runtime/migration-coordination.mjs'))
  mkdirSync(join(cwd,'node_modules/pg'),{recursive:true})
  writeFileSync(join(cwd,'node_modules/pg/package.json'),JSON.stringify({type:'module',exports:'./index.js'}))
  writeFileSync(join(cwd,'node_modules/pg/index.js'),`import { EventEmitter } from 'node:events';
    export class Client extends EventEmitter {
      async connect() {} async query() { return { rows: [{ acquired: true }] } }
      async end() { this.emit('end') }
    }`)
  symlinkSync(new URL('../node_modules/@next/env',import.meta.url).pathname,join(cwd,'node_modules/@next/env'),'dir')
  return join(cwd,'scripts/runtime-start.mjs')
}

test('missing build fails before Prisma migration can execute', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-artifact-')), marker=join(cwd,'migrated')
  try {
    mkdirSync(join(cwd,'node_modules/prisma/build'),{recursive:true})
    writeFileSync(join(cwd,'node_modules/prisma/build/index.js'),`require('fs').writeFileSync(${JSON.stringify(marker)},'ran')`)
    const script=isolatedStartup(cwd)
    assert.throws(() => execFileSync(process.execPath,[script],{cwd,stdio:'pipe'}), error => /npm run build/.test(error.stderr.toString()))
    assert.equal(existsSync(marker),false)
    assert.throws(() => runtimeEntry('worker',cwd,{}), /worker:build/)
    mkdirSync(join(cwd,'dist/worker'),{recursive:true})
    writeFileSync(join(cwd,'dist/worker/index.js'),'worker')
    assert.throws(() => runtimeEntry('worker',cwd,{}), /parser runtime/)
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})
test('checks standalone assets and honors isolated build directories', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-artifact-'))
  try {
    mkdirSync(join(cwd,'.next-local/standalone'),{recursive:true})
    writeFileSync(join(cwd,'.next-local/standalone/server.js'),'server')
    assert.throws(() => runtimeEntry('web',cwd,{NEXT_DIST_DIR:'.next-local'}),/assets/)
    mkdirSync(join(cwd,'.next-local/standalone/.next-local/static'),{recursive:true})
    mkdirSync(join(cwd,'.next-local/standalone/public'))
    assert.equal(runtimeEntry('web',cwd,{NEXT_DIST_DIR:'.next-local'}),'.next-local/standalone/server.js')
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})


test('a failed migration prevents a valid production server from booting', () => {
  const cwd=mkdtempSync(join(tmpdir(),'ff-migration-')), marker=join(cwd,'migration'), boot=join(cwd,'boot')
  try {
    const script=isolatedStartup(cwd)
    mkdirSync(join(cwd,'node_modules/prisma/build'),{recursive:true})
    writeFileSync(join(cwd,'node_modules/prisma/build/index.js'),`require('fs').writeFileSync(${JSON.stringify(marker)},'attempted');process.exit(7)`)
    mkdirSync(join(cwd,'.next/standalone/.next/static'),{recursive:true})
    mkdirSync(join(cwd,'.next/standalone/public'))
    writeFileSync(join(cwd,'.next/standalone/server.js'),`require('fs').writeFileSync(${JSON.stringify(boot)},'booted')`)
    assert.throws(() => execFileSync(process.execPath,[script],{cwd,stdio:'pipe',env:{...process.env,DATABASE_URL:'postgresql://fixture:fixture@localhost/fixture'}}), error => error.status === 7)
    assert.equal(existsSync(marker),true)
    assert.equal(existsSync(boot),false)
  } finally { rmSync(cwd,{recursive:true,force:true}) }
})
