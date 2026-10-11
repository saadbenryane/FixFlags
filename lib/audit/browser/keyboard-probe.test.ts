import type { Browser, BrowserContext, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { collectKeyboardEvidence, KEYBOARD_STEP_LIMIT } from './keyboard-probe'
import { runKeyboardChecks } from '../checks/keyboard'

const runBrowser = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
runBrowser('keyboard collector in Chromium', () => {
  let browser: Browser, context: BrowserContext, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await context?.close() })
  afterAll(closeBrowser)

  async function fixture(html: string) {
    context = await browser.newContext()
    page = await context.newPage()
    await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><body>' + html + '</body></html>' }))
    await page.goto('https://example.com/')
    return page
  }
  const collect = () => collectKeyboardEvidence(page, Date.now() + 5000)

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

  it('finds stripped focus styles on controls actually reached by Tab', async () => {
    await fixture('<style>button:focus {outline:none;box-shadow:none}</style><button id="one">Submit</button><button id="two">Cancel</button>')
    const evidence = await collect()
    expect(evidence.complete).toBe(true)
    expect(evidence.steps.map(step => step.indicator)).toEqual(['missing', 'missing'])
    expect(runKeyboardChecks(evidence).flags[0]).toMatchObject({ checkId: 'focus-visible-missing',
      evidenceTargets: [{ selector: '#one' }, { selector: '#two' }] })
  })

  it('recognizes a custom descendant focus style without calling it a missing outline', async () => {
    await fixture('<style>button {outline:none} button:focus-visible span {background:blue;color:white}</style><button><span>Action</span></button>')
    const evidence = await collect()
    expect(evidence.steps[0].indicator).toBe('styled')
    expect(runKeyboardChecks(evidence).flags).toEqual([])
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
    expect(runKeyboardChecks(sample).assertions.every(assertion => assertion.key === 'focus-styles')).toBe(true)
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
