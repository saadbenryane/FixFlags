import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { closeBrowser } from '../screenshot'
import { prisma } from '@/lib/db'
import { collectionHandlers } from '../progressive/collectors'
import { browserArtifactSchema } from '../progressive/snapshots'
import * as sessions from './page-session'
import { evaluatorHandlers } from '../progressive/evaluators'
import { readArtifact } from '../progressive/contracts'
import { checkArtifactSchema } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'
import { CHECK_REGISTRY } from '../check-registry'
import { scopedAssertionForTarget } from '../checks/verification'

vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] })))
const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('independent desktop document observations in native Chromium', () => {
  const pageUrl = 'https://example.com/independent-document'
  const audits: string[] = []
  let repaired = false
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const original = sessions.createAuditPage
    vi.spyOn(sessions, 'createAuditPage').mockImplementation((browser, url, options) => original(browser, url, { ...options,
      configurePage: async page => {
        await options.configurePage?.(page)
        await page.route('**/*', route => route.request().url() === pageUrl ? route.fulfill({ contentType: 'text/html',
          body: '<!doctype html><html lang="en"><head><title>Independent document evidence</title></head>' +
            '<body style="font-family:Arial;color:black;background:white"><main><h1>Useful public service</h1>' +
            '<button id="action"' + (repaired ? ' aria-label="Choose a service"' : '') + '></button></main>' +
            '<script>console.error("Controlled public script failure");' +
            'Object.defineProperty(document.documentElement,"outerHTML",{configurable:true,get(){delete this.outerHTML;throw new Error("Controlled HTML read interruption")}});</script></body></html>',
        }) : route.abort('blockedbyclient'))
      },
    }))
  })
  afterAll(async () => { vi.restoreAllMocks(); await closeBrowser()
    await prisma.audit.deleteMany({ where: { id: { in: audits } } }); await prisma.$disconnect() })

  async function observe() {
    const executionSpec = { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, scope: 'SITE', environment: 'production',
      checks: { 'buttons-no-text': CHECK_REGISTRY['buttons-no-text'].version }, outcomes: [], verificationTarget: null }
    const audit = await prisma.audit.create({ data: { url: pageUrl, executionSpec } }); audits.push(audit.id)
    const input = { pageUrl, position: 0, primary: true, role: 'primary', device: 'desktop' }
    const browser = await collectionHandlers.find(handler => handler.kind === 'browser')!.evaluate({ audit,
      task: { id: 'native-browser', targetKey: 'task:p0:browser' }, input,
      deadline: Date.now() + 20_000, dependencies: new Map(),
    } as unknown as TaskContext)
    const { snapshot } = browserArtifactSchema.parse(readArtifact(browser, 'browser').data)
    expect(snapshot.desktopHtml).toBeNull()
    expect(snapshot.desktopHttpStatus).toBe(200)
    expect(snapshot.captureFailures).toEqual([])
    expect(snapshot.consoleErrors).toContainEqual(expect.objectContaining({ text: 'Controlled public script failure' }))
    expect(snapshot.accessibilityEvidence?.rules).toContainEqual(expect.objectContaining({ id: 'button-name', state: repaired ? 'passed' : 'failed' }))
    const context = { audit,
    task: { id: 'accessibility-check' }, input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'accessibility' },
    deadline: Date.now() + 5000, dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED',
      workInput: { device: 'desktop' }, workResult: browser }]]) } as unknown as TaskContext
    return checkArtifactSchema.parse(readArtifact(await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(context), 'check').data)
  }

  it('flags an actual Accessibility failure, independently verifies repair and recognizes recurrence when whole HTML cannot be read', async () => {
    const original = await observe()
    const flag = original.flags.find(flag => flag.checkId === 'buttons-no-text')!
    expect(flag).toBeDefined()
    repaired = true
    const fixed = await observe()
    expect(fixed.flags.some(candidate => candidate.checkId === flag.checkId)).toBe(false)
    expect(scopedAssertionForTarget({ receipt: fixed.receipt, flag, checkId: flag.checkId })?.assertion).toMatchObject({ passed: true, complete: true })
    repaired = false
    expect((await observe()).flags).toContainEqual(expect.objectContaining({ checkId: flag.checkId }))
  }, 90_000)
})
