import type { Browser, BrowserContext, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { collectKeyboardEvidence, KEYBOARD_STEP_LIMIT } from './keyboard-probe'
import { runKeyboardChecks } from '../checks/keyboard'
import { scopedAssertionForTarget } from '../checks/verification'
import { bindAuditPageObservation } from './observation-scope'
import { DESKTOP_CAPTURE_PROFILE, MOBILE_CAPTURE_PROFILE, type CaptureProfile } from './capture-profile'
import { applyScanAccessCookies, type ScanAccessConfig } from '../scan-access'

const runBrowser = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
runBrowser('keyboard collector in Chromium', () => {
  let browser: Browser, context: BrowserContext, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await context?.close() })
  afterAll(closeBrowser)

  async function fixture(html: string, profile: CaptureProfile = DESKTOP_CAPTURE_PROFILE, access?: ScanAccessConfig) {
    context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, userAgent: profile.userAgent,
      isMobile: profile.isMobile, deviceScaleFactor: profile.deviceScaleFactor })
    await applyScanAccessCookies(context, 'https://example.com/', access)
    page = await context.newPage()
    await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body>' + html + '</body></html>' }))
    await page.goto('https://example.com/')
    bindAuditPageObservation(page, 'https://example.com/', profile, access, [])
    return page
  }
  const collect = () => collectKeyboardEvidence(page, Date.now() + 5000)

  it('inspects actual keyboard focus inside an open web component and retains its native target', async () => {
    const contents = '<style>button:focus{outline:none;box-shadow:none}</style><button id="action">Component action</button>'
    await fixture('<x-controls id="component"></x-controls><script>document.getElementById("component").attachShadow({mode:"open"}).innerHTML=' + JSON.stringify(contents) + '</script>')
    const observed = await collect()
    expect(observed).toMatchObject({ complete: true, candidateCount: 1, navigationComplete: true,
      steps: [{ selector: '#component >>> #action', label: 'Component action', indicator: 'missing' }] })
    expect(await page.locator(observed.steps[0].selector).count()).toBe(1)
    expect(runKeyboardChecks(observed).flags).toMatchObject([{ checkId: 'focus-visible-missing' }])
  })

  it('distinguishes same-named controls in separate shadow roots during exact repair', async () => {
    const markup = (fixed: boolean) => '<style>button:focus{outline:' + (fixed ? '3px solid blue' : 'none') + ';box-shadow:none}</style><button id="action">Action</button>'
    const render = (first: boolean, second: boolean) => '<x-controls id="first"></x-controls><x-controls id="second"></x-controls><script>' +
      'document.getElementById("first").attachShadow({mode:"open"}).innerHTML=' + JSON.stringify(markup(first)) + ';' +
      'document.getElementById("second").attachShadow({mode:"open"}).innerHTML=' + JSON.stringify(markup(second)) + '</script>'
    await fixture(render(false, false))
    const original = runKeyboardChecks(await collect()).flags.find(flag => flag.checkId === 'focus-visible-missing')!
    expect(original?.evidenceTargets?.map(target => target.selector)).toEqual(['#first >>> #action', '#second >>> #action'])
    for (const [second, expected] of [[false, false], [true, true]] as const) {
      await context.close(); await fixture(render(true, second))
      const current = await collect(), checked = runKeyboardChecks(current)
      expect(scopedAssertionForTarget({ checkId: original.checkId, flag: original, receipt: {
        kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: current.pageUrl, applicable: true,
        complete: current.complete, passed: checked.flags.length === 0, assertions: checked.assertions,
        execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: current.collectedAt },
      } })?.assertion.passed).toBe(expected)
    }
  })

  it('traverses nested roots and rendered slots once, excluding unassigned and inert controls', async () => {
    const contents = '<button id="first">First</button><slot name="actions"></slot><x-inner id="nested"></x-inner>' +
      '<section inert><slot name="ignored"></slot></section>'
    await fixture('<x-controls id="outer"><button slot="actions" id="slotted">Slotted</button>' +
      '<button slot="ignored">Inert</button><button>Unassigned</button></x-controls><button id="outside">Outside</button><script>' +
      'const root=document.getElementById("outer").attachShadow({mode:"open"});root.innerHTML=' + JSON.stringify(contents) + ';' +
      'root.getElementById("nested").attachShadow({mode:"open"}).innerHTML="<button id=inside>Nested</button>"</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: true, candidateCount: 4, navigationComplete: true })
    expect(evidence.steps.map(step => step.selector)).toEqual(['#outer >>> #first', '#slotted', '#outer >>> #nested >>> #inside', '#outside'])
    for (const step of evidence.steps) expect(await page.locator(step.selector).count()).toBe(1)
  })

  it('follows delegated focus without inventing a separate host control', async () => {
    await fixture('<x-controls id="component" tabindex="0"></x-controls><script>' +
      'document.getElementById("component").attachShadow({mode:"open",delegatesFocus:true}).innerHTML="<button id=action>Action</button>"</script>')
    expect(await collect()).toMatchObject({ complete: true, candidateCount: 1, steps: [{ selector: '#component >>> #action' }] })
  })

  it('keeps focus inside a closed root unverified', async () => {
    await fixture('<x-controls id="component"></x-controls><script>' +
      'document.getElementById("component").attachShadow({mode:"closed"}).innerHTML="<button>Hidden implementation</button>"</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: false, navigationComplete: false, reason: 'focus_scope_changed', steps: [] })
    expect(runKeyboardChecks(evidence).assertions.some(assertion => assertion.passed)).toBe(false)
  })

  it('finds an actual trap inside a component through Tab, reverse Tab and Escape', async () => {
    await fixture('<x-controls id="component"></x-controls><button>Outside</button><script>' +
      'const root=document.getElementById("component").attachShadow({mode:"open"});root.innerHTML="<button id=trap>Trapped</button>";' +
      'root.getElementById("trap").onkeydown=e=>{if(e.key==="Tab")e.preventDefault()}</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ candidateCount: 2, trap: 'blocked', reason: 'focus_cycle_persisted',
      steps: [{ selector: '#component >>> #trap' }] })
    expect(runKeyboardChecks(evidence).flags.some(flag => flag.checkId === 'keyboard-nav-trap')).toBe(true)
  })

  it('inspects declared component menus in their own roots without confusing repeated IDs', async () => {
    const contents = '<button id="open" aria-haspopup="menu" aria-controls="menu">Options</button>' +
      '<div id="menu" role="menu" hidden><button id="one" role="menuitem" tabindex="-1">One</button><button id="two" role="menuitem" tabindex="-1">Two</button></div>'
    await fixture('<x-controls id="first"></x-controls><x-controls id="second"></x-controls><script>' +
      'for(const id of ["first","second"]){const root=document.getElementById(id).attachShadow({mode:"open"});root.innerHTML=' + JSON.stringify(contents) + ';' +
      'const trigger=root.getElementById("open"),menu=root.getElementById("menu"),items=[root.getElementById("one"),root.getElementById("two")];' +
      'trigger.onclick=()=>{menu.hidden=false;items[0].focus()};menu.onkeydown=e=>{' +
      'if(["ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();if(id==="first")items[1-items.indexOf(root.activeElement)].focus()}' +
      'if(e.key==="Escape"){menu.hidden=true;trigger.focus()}}}</script>')
    const evidence = await collect()
    expect(evidence.interactions).toMatchObject([
      { trigger: { selector: '#first >>> #open' }, popup: { selector: '#first >>> #menu' }, openedBy: 'enter', entry: 'inside', arrows: 'moved', escape: 'closed', restoration: 'trigger' },
      { trigger: { selector: '#second >>> #open' }, popup: { selector: '#second >>> #menu' }, openedBy: 'enter', entry: 'inside', arrows: 'stuck', escape: 'closed', restoration: 'trigger' },
    ])
    const failure = runKeyboardChecks(evidence).flags.find(flag => flag.checkId === 'keyboard-menu-navigation')!
    expect(failure.evidenceTargets).toMatchObject([{ selector: '#second >>> #open' }])
  })

  it('activates the recorded component opener when a nested root reuses its ID', async () => {
    const contents = '<button id="open" aria-haspopup="menu" aria-controls="menu">Options</button><x-inner id="nested"></x-inner>' +
      '<div id="menu" role="menu" hidden><button id="one" role="menuitem" tabindex="-1">One</button><button id="two" role="menuitem" tabindex="-1">Two</button></div>'
    await fixture('<x-controls id="outer"></x-controls><script>' +
      'const root=document.getElementById("outer").attachShadow({mode:"open"});root.innerHTML=' + JSON.stringify(contents) + ';' +
      'root.getElementById("nested").attachShadow({mode:"open"}).innerHTML="<button id=open>Nested action</button>";' +
      'const trigger=root.getElementById("open"),menu=root.getElementById("menu"),items=[root.getElementById("one"),root.getElementById("two")];' +
      'trigger.onclick=()=>{menu.hidden=false;items[0].focus()};menu.onkeydown=e=>{' +
      'if(["ArrowDown","ArrowUp"].includes(e.key)){e.preventDefault();items[1-items.indexOf(root.activeElement)].focus()}' +
      'if(e.key==="Escape"){menu.hidden=true;trigger.focus()}}</script>')
    expect((await collect()).interactions).toMatchObject([
      { trigger: { selector: '#outer >>> #open' }, popup: { selector: '#outer >>> #menu' }, openedBy: 'enter',
        entry: 'inside', arrows: 'moved', escape: 'closed', restoration: 'trigger' },
    ])
  })

  it('does not certify controls beyond the bounded document inventory', async () => {
    await fixture('<span></span>'.repeat(20_001) + '<button id="beyond">Uninspected action</button>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: false, limitations: ['document_tree_limit'], candidateCount: 0 })
    expect(runKeyboardChecks(evidence).assertions.some(assertion => assertion.passed)).toBe(false)
  })

  it('independently compares native keyboard repair under the original browser and access conditions', async () => {
    const controls = '<button id="action">Original action</button>'
    await fixture('<style>button:focus{outline:none;box-shadow:none}</style>' + controls)
    const original = runKeyboardChecks(await collect()).flags.find(flag => flag.checkId === 'focus-visible-missing')!
    expect(original).toBeDefined()
    const conditions: Array<[CaptureProfile, ScanAccessConfig | undefined]> = [[DESKTOP_CAPTURE_PROFILE, undefined], [MOBILE_CAPTURE_PROFILE, undefined],
      [DESKTOP_CAPTURE_PROFILE, { cookies: [{ name: 'session', value: 'private-fixture-session' }] }]]
    for (const [profile, access] of conditions) {
      await context.close()
      await fixture(controls, profile, access)
      if (access) expect(await context.cookies('https://example.com/')).toContainEqual(expect.objectContaining({
        name: 'session', domain: 'example.com', path: '/',
      }))
      const current = await collect(), checked = runKeyboardChecks(current)
      const proof = scopedAssertionForTarget({ checkId: original.checkId, flag: original, receipt: {
        kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: current.pageUrl,
        applicable: true, complete: current.complete, passed: checked.flags.length === 0, assertions: checked.assertions,
        execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: current.collectedAt },
      } })
      if (profile === DESKTOP_CAPTURE_PROFILE && !access) expect(proof?.assertion.passed).toBe(true)
      else expect(proof).toBeUndefined()
      expect(JSON.stringify(current)).not.toContain('private-fixture-session')
    }
  })

  it('exercises native controls and records positive assertions only after a complete traversal', async () => {
    await fixture('<button id="one">First</button><button id="two">Second</button><button disabled>Disabled</button><input type="hidden" value="PRIVATE">')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: true, candidateCount: 2, trap: 'not_observed', reason: 'document_boundary_observed' })
    expect(evidence.steps.map(step => step.selector)).toEqual(['#one', '#two'])
    expect(evidence.steps.map(step => step.indicator)).toEqual(['styled', 'styled'])
    expect(JSON.stringify(evidence)).not.toContain('PRIVATE')
    expect(runKeyboardChecks(evidence).assertions).toHaveLength(3)
    expect(runKeyboardChecks(evidence).assertions.every(assertion => assertion.passed)).toBe(true)
  })

  it.each([
    ['checked', '<input id="first" type="radio" name="choice" checked><input id="second" type="radio" name="choice">', ['#first', '#done']],
    ['later checked', '<input id="first" type="radio" name="choice"><input id="second" type="radio" name="choice" checked>', ['#second', '#done']],
    ['unchecked', '<input id="first" type="radio" name="choice"><input id="second" type="radio" name="choice">', ['#first', '#done']],
    ['disabled checked', '<input id="first" type="radio" name="choice" checked disabled><input id="second" type="radio" name="choice">', ['#second', '#done']],
    ['separate forms', '<form><input id="first" type="radio" name="choice" checked><input type="radio" name="choice"></form>' +
      '<form><input id="second" type="radio" name="choice" checked><input type="radio" name="choice"></form>', ['#first', '#second', '#done']],
    ['unnamed', '<input id="first" type="radio"><input id="second" type="radio">', ['#first', '#second', '#done']],
    ['positive tabindex', '<input id="first" type="radio" name="choice" tabindex="2"><input id="second" type="radio" name="choice" tabindex="1">', ['#second', '#done']],
  ])('uses native radio-group tab stops for %s groups', async (_name, controls, selectors) => {
    await fixture(controls + '<button id="done">Done</button>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ candidateCount: selectors.length, navigationComplete: true })
    expect(evidence.steps.map(step => step.selector)).toEqual(selectors)
    expect(evidence.trap).toBe('not_observed')
  })

  it('keeps same-named native radio groups separate across component roots', async () => {
    const contents = '<input id="first" type="radio" name="choice" checked><input id="second" type="radio" name="choice">'
    await fixture('<x-controls id="first"></x-controls><x-controls id="second"></x-controls><button id="done">Done</button><script>' +
      'for(const id of ["first","second"])document.getElementById(id).attachShadow({mode:"open"}).innerHTML=' + JSON.stringify(contents) + '</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ candidateCount: 3, navigationComplete: true })
    expect(evidence.steps.map(step => step.selector)).toEqual(['#first >>> #first', '#second >>> #first', '#done'])
  })

  it('finds stripped focus styles on controls actually reached by Tab', async () => {
    await fixture('<style>button:focus {outline:none;box-shadow:none}</style><button id="one">Submit</button><button id="two">Cancel</button>')
    const evidence = await collect()
    expect(evidence.complete).toBe(true)
    expect(evidence.steps.map(step => step.indicator)).toEqual(['missing', 'missing'])
    expect(runKeyboardChecks(evidence).flags[0]).toMatchObject({ checkId: 'focus-visible-missing',
      evidenceTargets: [{ selector: '#one' }, { selector: '#two' }] })
  })
  it('does not count permanent decoration as a cue identifying the focused control', async () => {
    await fixture('<style>button{outline:3px solid blue;box-shadow:none}button:focus-visible{outline:3px solid blue;box-shadow:none}</style><button id="one">First</button><button id="two">Second</button>')
    const observed = await collect()
    expect(observed.steps.map(step => step.indicator)).toEqual(['missing', 'missing'])
    const original = runKeyboardChecks(observed).flags.find(flag => flag.checkId === 'focus-visible-missing')!
    expect(original.evidenceTargets).toMatchObject([{ selector: '#one' }, { selector: '#two' }])
    await context.close()
    await fixture('<style>button{outline:3px solid blue;box-shadow:none}button:focus-visible{outline:3px solid red}</style><button id="one">First</button><button id="two">Second</button>')
    const repaired = await collect(), checked = runKeyboardChecks(repaired)
    expect(repaired.steps.map(step => step.indicator)).toEqual(['styled', 'styled'])
    expect(scopedAssertionForTarget({ checkId: original.checkId, flag: original, receipt: {
      kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: repaired.pageUrl,
      applicable: true, complete: repaired.complete, passed: checked.flags.length === 0, assertions: checked.assertions,
      execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: repaired.collectedAt },
    } })?.assertion.passed).toBe(true)
  })

  it('recognizes a custom descendant focus style without calling it a missing outline', async () => {
    await fixture('<style>button {outline:none} button:focus-visible span {background:blue;color:white}</style><button><span>Action</span></button>')
    const evidence = await collect()
    expect(evidence.steps[0].indicator).toBe('styled')
    expect(runKeyboardChecks(evidence).flags).toEqual([])
  })
  it('does not certify an outline matching its uniform surrounding background, and verifies a contrasting repair', async () => {
    await fixture('<style>body{padding:20px;background:white}button{outline:none;box-shadow:none}button:focus-visible{outline:3px solid white;outline-offset:2px}</style><button id="action">Action</button>')
    const observed = await collect(), original = runKeyboardChecks(observed).flags.find(flag => flag.checkId === 'focus-visible-missing')!
    expect(observed.steps).toMatchObject([{ selector: '#action', indicator: 'missing' }])
    expect(original).toBeDefined()
    await context.close()
    await fixture('<style>body{padding:20px;background:white}button{outline:none;box-shadow:none}button:focus-visible{outline:3px solid blue;outline-offset:2px}</style><button id="action">Action</button>')
    const repaired = await collect(), checked = runKeyboardChecks(repaired)
    expect(repaired.steps).toMatchObject([{ selector: '#action', indicator: 'styled' }])
    expect(scopedAssertionForTarget({ checkId: original.checkId, flag: original, receipt: {
      kind: 'site-module-check', version: 1, module: 'keyboard', pageUrl: repaired.pageUrl,
      applicable: true, complete: repaired.complete, passed: checked.flags.length === 0, assertions: checked.assertions,
      execution: { auditId: 'after', taskId: 'keyboard', checkVersion: 1, source: 'keyboard', collectedAt: repaired.collectedAt },
    } })?.assertion.passed).toBe(true)
  })

  it('keeps an outline over a patterned background inconclusive', async () => {
    await fixture('<style>body{padding:20px;background:linear-gradient(white,blue)}button{outline:none;box-shadow:none}button:focus-visible{outline:3px solid white;outline-offset:2px}</style><button id="action">Action</button>')
    const evidence = await collect(), checked = runKeyboardChecks(evidence)
    expect(evidence.steps).toMatchObject([{ selector: '#action', indicator: 'unknown' }])
    expect(checked.assertions.find(assertion => assertion.key === 'focus-styles')).toMatchObject({ complete: false, passed: false })
    expect(checked.flags.some(flag => flag.checkId === 'focus-visible-missing')).toBe(false)
  })
  it.each([
    ['clipped', '<div style="display:inline-block;overflow:hidden"><button id="action">Action</button></div>', ''],
    ['dark canvas', '<button id="action">Action</button>', 'html{color-scheme:dark}'],
  ])('keeps a %s outline inconclusive', async (_label, markup, additionalStyle) => {
    await fixture(`<style>button{outline:none;box-shadow:none}button:focus-visible{outline:3px solid white;outline-offset:2px}${additionalStyle}</style>${markup}`)
    const evidence = await collect()
    expect(evidence.steps).toMatchObject([{ selector: '#action', indicator: 'unknown' }])
    expect(runKeyboardChecks(evidence).flags.some(flag => flag.checkId === 'focus-visible-missing')).toBe(false)
  })
  it('keeps a text caret inconclusive when permanent decoration does not change with focus', async () => {
    await fixture('<style>input{outline:3px solid blue;box-shadow:none}input:focus-visible{outline:3px solid blue}</style><input id="field" aria-label="Name">')
    const observed = await collect(), checked = runKeyboardChecks(observed)
    expect(observed.steps).toMatchObject([{ selector: '#field', indicator: 'unknown' }])
    expect(checked.flags.some(flag => flag.checkId === 'focus-visible-missing')).toBe(false)
    expect(checked.assertions.find(assertion => assertion.key === 'focus-styles')).toMatchObject({ complete: false, passed: false })
  })
  it('does not certify a changed decoration when the control was already focused at registration', async () => {
    await fixture('<style>button{outline:3px solid blue}</style><button id="one">First</button><button>Second</button><script>const control=document.getElementById("one");control.focus();control.onkeydown=event=>{if(event.key==="Tab"){event.preventDefault();control.style.outlineColor="red"}}</script>')
    const observed = await collect(), checked = runKeyboardChecks(observed)
    expect(observed.steps).toMatchObject([{ selector: '#one', indicator: 'unknown' }])
    expect(checked.assertions.find(assertion => assertion.key === 'focus-styles')).toMatchObject({ complete: false, passed: false })
    expect(checked.flags.some(flag => flag.checkId === 'keyboard-nav-trap')).toBe(true)
    expect(checked.flags.some(flag => flag.checkId === 'focus-visible-missing')).toBe(false)
  })

  it.each([
    ['hidden child', '<span hidden>Hidden</span>', 'button:focus-visible span{color:blue}'],
    ['transparent child', '<span style="opacity:0">Hidden</span>', 'button:focus-visible span{background:blue}'],
    ['ungenerated pseudo-element', '', 'button:focus-visible::after{background:blue;color:white}'],
    ['transparent outline', '', 'button:focus-visible{outline:3px solid color(srgb 0 0 1 / 0)}'],
    ['transparent shadow', '', 'button:focus-visible{box-shadow:0 0 0 3px color(srgb 0 0 1 / 0)}'],
  ])('does not count a %s as a visible focus indicator', async (_name, child, style) => {
    await fixture(`<style>button{outline:none;box-shadow:none}${style}</style><button id="action">Action${child}</button>`)
    const evidence = await collect()
    expect(evidence.complete).toBe(true)
    expect(evidence.steps[0].indicator).toBe('missing')
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toContain('focus-visible-missing')
  })

  it('recognizes generated pseudo-elements and painted shadows as focus indicators', async () => {
    await fixture('<style>button{outline:none;box-shadow:none}#pseudo:focus-visible::after{content:"";display:block;width:20px;height:3px;background:blue}#shadow:focus-visible{box-shadow:0 0 0 3px color(srgb 0 0 1 / 1)}</style><button id="pseudo">Pseudo</button><button id="shadow">Shadow</button>')
    expect((await collect()).steps.map(step => step.indicator)).toEqual(['styled', 'styled'])
  })

  it('observes a persistent trap using forward, reverse, and Escape keys', async () => {
    await fixture('<button id="trap">Trapped</button><button>Other control</button><script>document.getElementById("trap").addEventListener("keydown", e => { if(e.key === "Tab") e.preventDefault() })</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: false, trap: 'blocked', reason: 'focus_cycle_persisted' })
    expect(runKeyboardChecks(evidence).flags.some(flag => flag.checkId === 'keyboard-nav-trap')).toBe(true)
    expect(runKeyboardChecks(evidence).assertions.find(assertion => assertion.key === 'keyboard-exit')?.passed).toBe(false)
  })

  it('does not blame an intentional modal focus boundary that Escape dismisses', async () => {
    await fixture('<button>Outside</button><dialog id="dialog"><button>First</button><button>Second</button></dialog><script>document.querySelector("dialog").showModal()</script>')
    const evidence = await collect()
    expect(evidence.trap).toBe('escaped')
    expect(runKeyboardChecks(evidence).flags.some(flag => flag.checkId === 'keyboard-nav-trap')).toBe(false)
    expect(evidence.complete).toBe(false)
  })

  it('keeps a modal requiring control activation inconclusive and never clicks its button', async () => {
    await fixture('<button>Outside</button><dialog><button id="close">Close</button><button>Next</button></dialog><script>const d=document.querySelector("dialog");d.showModal();d.addEventListener("cancel", e=>e.preventDefault());document.getElementById("close").onclick=()=>{document.body.dataset.clicked="yes";d.close()}</script>')
    const evidence = await collect()
    expect(evidence).toMatchObject({ complete: false, trap: 'unknown', reason: 'dialog_requires_activation' })
    expect(await page.locator('body').getAttribute('data-clicked')).toBeNull()
    expect(runKeyboardChecks(evidence).flags.some(flag => flag.checkId === 'keyboard-nav-trap')).toBe(false)
  })

  it('records a positive-tabindex backward jump as an explicit order heuristic', async () => {
    await fixture('<button id="normal">First in DOM</button><button id="positive" tabindex="1">Second in DOM</button>')
    const evidence = await collect()
    expect(evidence.steps.map(step => step.selector)).toEqual(['#positive', '#normal'])
    expect(runKeyboardChecks(evidence).flags.find(flag => flag.checkId === 'keyboard-tab-order')?.evidence).toContain('heuristic')
  })

  it('retains sample and deadline limits without manufacturing successful assertions', async () => {
    await fixture(Array.from({ length: KEYBOARD_STEP_LIMIT + 5 }, (_, index) => `<button>${index}</button>`).join(''))
    const sample = await collect()
    expect(sample).toMatchObject({ complete: false, reason: 'step_limit' })
    expect(sample.steps).toHaveLength(KEYBOARD_STEP_LIMIT)
    const checked = runKeyboardChecks(sample)
    expect(checked.assertions.filter(assertion => assertion.complete !== false).every(assertion => assertion.key === 'focus-styles')).toBe(true)
    expect(checked.assertions.filter(assertion => assertion.key === 'tab-sequence' || assertion.key === 'keyboard-exit')
      .every(assertion => assertion.passed === false && assertion.complete === false)).toBe(true)
    const expired = await collectKeyboardEvidence(page, Date.now() - 1)
    expect(expired).toMatchObject({ complete: false, reason: 'deadline_exhausted', steps: [] })
    expect(runKeyboardChecks(expired).assertions).toEqual([])
  })
})

const menu = (behavior = 'working') => `
<button id="open" aria-haspopup="menu" aria-controls="menu">Options</button>
<div id="menu" role="menu" hidden><button role="menuitem" tabindex="-1" id="first">First</button><button role="menuitem" tabindex="-1" id="second">Second</button></div>
<script>
const trigger=document.getElementById('open'), popup=document.getElementById('menu');
const items=[...popup.querySelectorAll('[role=menuitem]')];
trigger.onclick=()=>{popup.hidden=false; ${behavior === 'no-entry' ? '' : 'items[0].focus()'}};
popup.onkeydown=e=>{
 ${behavior === 'stuck' ? '' : "if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();items[(items.indexOf(document.activeElement)+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus()}"}
 if(e.key==='Escape'){ ${behavior === 'no-escape' ? '' : "popup.hidden=true;" + (behavior === 'lost' ? 'document.activeElement.blur()' : behavior === 'alternate' ? "document.getElementById('after').focus()" : 'trigger.focus()')} }
};
</script><button id="after">After</button>`

runBrowser('declared popup keyboard behavior in Chromium', () => {
  let browser: Browser, context: BrowserContext, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await context?.close() })
  afterAll(closeBrowser)
  async function collect(html: string) {
    context = await browser.newContext(); page = await context.newPage()
    await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body>' + html + '</body></html>' }))
    await page.goto('https://example.com/')
    return collectKeyboardEvidence(page, Date.now() + 8000)
  }
  it('opens, navigates and dismisses a menu without activating any item', async () => {
    const evidence = await collect(menu().replace('</div>', '<button role="menuitem" tabindex="-1" id="third">Third</button></div>'))
    expect(evidence.interactions).toMatchObject([{ kind: 'menu', openedBy: 'enter', entry: 'inside', arrows: 'moved', escape: 'closed', restoration: 'trigger', complete: true }])
    expect(runKeyboardChecks(evidence).flags).toEqual([])
    expect(evidence.interactions![0].steps.map(step => step.selector)).toEqual(['#first', '#second', '#third'])
    expect(evidence.interactions![0].trigger.rect.x).toBeLessThan(1)
  })
  it('uses effective aria-activedescendant focus and horizontal menu navigation', async () => {
    const evidence = await collect('<button id="open" aria-haspopup="menu" aria-controls="menu">Options</button>' +
      '<div id="menu" role="menu" aria-orientation="horizontal" tabindex="-1" hidden><span role="menuitem" id="first">First</span><span role="menuitem" id="second">Second</span></div>' +
      '<script>const p=document.getElementById("menu"),t=document.getElementById("open");t.onclick=()=>{p.hidden=false;p.focus();p.setAttribute("aria-activedescendant","first")};' +
      'p.onkeydown=e=>{if(e.key==="ArrowRight")p.setAttribute("aria-activedescendant","second");if(e.key==="ArrowLeft")p.setAttribute("aria-activedescendant","first");if(e.key==="Escape"){p.hidden=true;t.focus()}}</script>')
    expect(evidence.interactions![0]).toMatchObject({ entry: 'inside', arrows: 'moved', escape: 'closed', restoration: 'trigger' })
    expect(runKeyboardChecks(evidence).flags).toEqual([])
  })
  it('observes a native modal boundary and restores focus after Escape', async () => {
    const evidence = await collect('<button id="open" aria-haspopup="dialog" aria-controls="popup">Details</button><dialog id="popup"><button>First</button><button>Second</button></dialog><script>document.getElementById("open").onclick=()=>document.getElementById("popup").showModal()</script><button>After</button>')
    expect(evidence.interactions).toMatchObject([{ kind: 'dialog', openedBy: 'enter', entry: 'inside', containment: 'contained', escape: 'closed', restoration: 'trigger', complete: true }])
    expect(runKeyboardChecks(evidence).flags).toEqual([])
  })
  it('fully exercises a native modal containing a radio group without expecting every option in the Tab sequence', async () => {
    const evidence = await collect('<button id="open" aria-haspopup="dialog" aria-controls="popup">Details</button>' +
      '<dialog id="popup"><input type="radio" name="choice" checked><input type="radio" name="choice"><button>Done</button></dialog>' +
      '<script>document.getElementById("open").onclick=()=>document.getElementById("popup").showModal()</script><button>After</button>')
    expect(evidence.interactions).toMatchObject([{ kind: 'dialog', openedBy: 'enter', entry: 'inside', containment: 'contained',
      escape: 'closed', restoration: 'trigger', complete: true }])
    expect(runKeyboardChecks(evidence).flags).toEqual([])
  })
  it('finds actual arrow-key, Escape, entry and modal-boundary failures', async () => {
    let evidence = await collect(menu('stuck'))
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toContain('keyboard-menu-navigation')
    await context.close()
    evidence = await collect(menu('no-escape'))
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toContain('keyboard-popup-escape')
    await context.close()
    evidence = await collect('<button id="open" aria-haspopup="dialog" aria-controls="popup">Details</button><div id="popup" role="dialog" aria-modal="true" hidden><button>First</button></div><button id="after">After</button><script>const p=document.getElementById("popup"),t=document.getElementById("open");t.onclick=()=>{p.hidden=false};document.onkeydown=e=>{if(e.key==="Escape"){p.hidden=true;t.focus()}}</script>')
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toEqual(expect.arrayContaining(['keyboard-popup-focus', 'keyboard-modal-boundary']))
  })
  it('proves unavailable keyboard activation only when a guarded pointer opens the popup', async () => {
    const html = menu().replace('<button id="open"', '<span role="button" tabindex="0" id="open"').replace('Options</button>', 'Options</span>')
    const evidence = await collect(html)
    expect(evidence.interactions![0].openedBy).toBe('pointer')
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toContain('keyboard-popup-opening')
  })
  it('reaches disclosed content without imposing dialog Escape requirements or activating its actions', async () => {
    const evidence = await collect('<button id="open" aria-expanded="false" aria-controls="content">More options</button>' +
      '<div id="content" hidden><button id="action">Choice</button></div><button>After</button>' +
      '<script>const t=document.getElementById("open"),p=document.getElementById("content");t.onclick=()=>{p.hidden=!p.hidden;t.setAttribute("aria-expanded",String(!p.hidden))};' +
      'document.getElementById("action").onclick=()=>document.body.dataset.activated="yes"</script>')
    expect(evidence.interactions![0]).toMatchObject({ kind: 'disclosure', entry: 'inside', escape: 'remained', reason: 'disclosure_toggled_closed', complete: true })
    expect(runKeyboardChecks(evidence).flags).toEqual([])
    expect(await page.locator('#content').isVisible()).toBe(false)
    expect(await page.locator('body').getAttribute('data-activated')).toBeNull()
  })
  it('distinguishes lost focus from a different visible workflow destination', async () => {
    let evidence = await collect(menu('lost'))
    expect(evidence.interactions![0].restoration).toBe('lost')
    expect(runKeyboardChecks(evidence).flags.map(flag => flag.checkId)).toContain('keyboard-focus-restoration')
    await context.close()
    evidence = await collect(menu('alternate'))
    expect(evidence.interactions![0].restoration).toBe('other')
    const result = runKeyboardChecks(evidence)
    expect(result.flags).toEqual([])
    expect(result.assertions.find(assertion => assertion.key === 'focus-restoration')).toMatchObject({ complete: false, passed: false })
  })
  it('retains independent observations when an opener attempts a protected mutation', async () => {
    const evidence = await collect('<style>#plain:focus{outline:none;box-shadow:none}</style><button id="plain">Plain</button><button aria-haspopup="menu" aria-controls="menu">Options</button><div role="menu" id="menu" hidden><button role="menuitem">Action</button></div><script>document.querySelector("[aria-haspopup]").onclick=()=>fetch("/mutate",{method:"POST"}).then(()=>{document.getElementById("menu").hidden=false})</script>')
    expect(evidence.navigationComplete).toBe(true)
    expect(evidence.interactions![0]).toMatchObject({ reason: 'scanner_boundary_refused', complete: false })
    const result = runKeyboardChecks(evidence)
    expect(result.flags.map(flag => flag.checkId)).toEqual(['focus-visible-missing'])
    expect(result.assertions.find(assertion => assertion.key === 'popup-open')).toMatchObject({ complete: false })
  })
  it('preserves observed widget behavior when unrelated requests were already refused on page load', async () => {
    await collect(menu())
    const evidence = await collectKeyboardEvidence(page, Date.now() + 8000, { refusalCount: () => 1 })
    expect(evidence.limitations).toContain('initial_resources_unavailable')
    expect(evidence.interactions![0]).toMatchObject({ openedBy: 'enter', escape: 'closed', restoration: 'trigger' })
    expect(runKeyboardChecks(evidence).flags).toEqual([])
    expect(evidence.complete).toBe(false)
  })
  it('leaves unsafe submit openers untested and embedded focus inconclusive', async () => {
    let evidence = await collect('<form><button aria-haspopup="dialog" aria-controls="popup">Details</button></form><dialog id="popup"><button>First</button></dialog><script>document.querySelector("button").onclick=()=>document.body.dataset.activated="yes"</script>')
    expect(evidence.interactions![0].reason).toBe('unsafe_or_unsupported_trigger')
    expect(await page.locator('body').getAttribute('data-activated')).toBeNull()
    await context.close()
    evidence = await collect('<iframe srcdoc="<button>Inside</button>"></iframe><button>After</button>')
    expect(evidence.reason).toBe('focus_scope_changed')
    expect(evidence.trap).not.toBe('blocked')
  })
})
