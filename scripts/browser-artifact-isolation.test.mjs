import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
test('actual browser runner preserves foundation and earlier-stage artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fixflags-browser-artifacts-'))
  try {
    const receipts = join(directory, 'test-results/release/run-1')
    mkdirSync(receipts, {recursive:true})
    writeFileSync(join(receipts,'foundation.json'),'original foundation')
    writeFileSync(join(receipts,'fixtures.json'),'original fixtures')
    const fixtures=join(directory,'cases');mkdirSync(fixtures)
    writeFileSync(join(fixtures,'isolation.spec.ts'), `import {test,expect} from ${JSON.stringify(resolve(root,'node_modules/@playwright/test/index.js'))};test('filesystem isolation fixture',()=>expect(true).toBe(true));`)
    const config=join(directory,'isolation.config.ts')
    writeFileSync(config,`import base from ${JSON.stringify(join(root,'playwright.config.ts'))};export default {...base,testDir:${JSON.stringify(fixtures)},reporter:'json'};`)
    for(const stage of ['credentialed-core','external']) {
      const output=join(receipts,stage+'-playwright.json')
      const result=spawnSync(process.execPath,[join(root,'node_modules/playwright/cli.js'),'test','--config',config],{cwd:directory,encoding:'utf8',env:{...process.env,E2E_BASE_URL:'https://example.invalid',E2E_CREDENTIALED:'false',RELEASE_RUN_ID:'run-1',RELEASE_JOURNEY_STAGE:stage,PLAYWRIGHT_JSON_OUTPUT_FILE:output},timeout:30000})
      assert.equal(result.status,0,result.stderr)
      assert.equal(JSON.parse(readFileSync(output)).stats.expected,1)
    }
    assert.equal(readFileSync(join(receipts,'foundation.json'),'utf8'),'original foundation')
    assert.equal(readFileSync(join(receipts,'fixtures.json'),'utf8'),'original fixtures')
    for(const stage of ['credentialed-core','external'])assert.equal(existsSync(join(receipts,stage+'-playwright.json')),true)
  } finally {rmSync(directory,{recursive:true,force:true})}
})
