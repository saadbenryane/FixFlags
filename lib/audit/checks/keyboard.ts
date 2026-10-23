import type { KeyboardEvidence } from '../browser/keyboard-probe'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { captureObservationKey, capturePageKey } from '../browser/observation-scope'

export const KEYBOARD_CONTEXT_PATTERN = /^keyboard:[a-f0-9]{64}:[a-f0-9]{64}:.+$/

/** Each assertion retains its exercised scope. Module completion is only a
 * summary; an unrelated untested popup cannot supply or erase repair evidence. */
export function runKeyboardChecks(evidence: KeyboardEvidence): { flags: DeterministicFlag[]; assertions: CheckAssertion[] } {
  const flags: DeterministicFlag[] = [], assertions: CheckAssertion[] = []
  const targets = [...new Map(evidence.steps.map(step => [step.selector, step])).values()]
  // A protected-action refusal ends the probe. Measured failures remain; an unfinished pass does not.
  const navigationComplete = !evidence.limitations.includes('protected_action_refused') && (evidence.navigationComplete ?? evidence.complete)
  const missing = targets.filter(step => step.indicator === 'missing')
  const reversed = targets.filter((step, index) => index > 0 && step.domOrder < targets[index - 1].domOrder &&
    targets.slice(0, index).some(previous => previous.tabIndex > 0))
  const scopeKey = evidence.scope && evidence.scope.finalUrl === evidence.pageUrl ? captureObservationKey(evidence.scope) : 'unknown'
  const pageUrl = evidence.scope?.pageUrl ?? evidence.pageUrl
  const prefix = scopeKey !== 'unknown' ? `keyboard:${capturePageKey(evidence.scope!.pageUrl)}:${scopeKey}:` : 'keyboard:unknown:'
  const scopedContext = (phase = 'page_load') => phase.startsWith(prefix) ? phase : prefix + phase
  const locations = (steps: Array<Pick<typeof targets[number], 'selector' | 'label' | 'rect'>>, context?: string) => steps.map(step => ({ kind: 'element' as const, source: 'measured' as const,
    device: 'desktop' as const, selector: step.selector,
    ...(!context && Object.values(step.rect).every(value => value >= 0 && value <= 1) && step.rect.width >= 0.01 && step.rect.height >= 0.01 ? { rect: step.rect } : {}),
    label: step.label || 'Keyboard control', context: scopedContext(context) }))
  const verificationRule = 'Keyboard probe: repeat navigation on this page and inspect the same recorded controls before certifying the repair.'
  function focusObservations(controls: typeof targets, context?: string, name = 'Focus indicators on exercised controls') {
    context = scopedContext(context)
    for (const indicator of ['styled', 'missing', 'unknown'] as const) {
      const observed = controls.filter(step => step.indicator === indicator)
      if (!observed.length) continue
      assertions.push({ key: 'focus-styles', name, expected: 'The recorded controls have an observable focus outline or style change',
        observed: `${observed.length} reached controls ${indicator === 'styled' ? 'had a recorded focus style' : indicator === 'missing' ? 'lacked an observed focus style' : 'had focus effects that could not be classified'}. Unvisited controls, pixel contrast, and assistive technology were not evaluated.`,
        passed: indicator === 'styled', complete: indicator !== 'unknown', ...(context ? { context } : {}),
        targets: observed.map(step => ({ selector: step.selector, label: step.label || 'Keyboard control', ...(context ? { context } : {}) })) })
    }
  }
  if (missing.length) flags.push({ checkId: 'focus-visible-missing', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
    problem: `${missing.length} keyboard control${missing.length === 1 ? ' has' : 's have'} no observed focus indicator`,
    evidence: `Tab actually focused ${missing.map(step => step.label || step.selector).slice(0, 5).join(', ')}. No visible outline or focus-related style change was recorded. This inspects computed styles, not focus contrast or every visual effect.`,
    fix: '1. Add a visible :focus-visible outline or another clear focus indicator to the recorded controls.\n2. Preserve their current layout and labels.\n3. Use Tab and Shift+Tab to check that focus remains visible, including when scrolled.',
    confidence: 0.9, source: 'DETERMINISTIC', pageUrl, verificationRule, evidenceTargets: locations(missing) })
  if (evidence.trap === 'blocked') flags.push({ checkId: 'keyboard-nav-trap', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
    problem: 'Keyboard navigation is stuck in a repeated focus cycle',
    evidence: `Tab repeated the recorded controls, Shift+Tab remained in the cycle, and Escape did not exit. ${evidence.candidateCount - targets.length} other eligible controls remained unvisited.`,
    fix: '1. Remove the handler that prevents keyboard users from leaving these controls.\n2. Keep a modal focus boundary only while the modal is open and provide a reachable dismissal control.\n3. Verify Tab, Shift+Tab, and Escape, then restore focus to the trigger when closing.',
    confidence: 0.95, source: 'DETERMINISTIC', pageUrl, verificationRule, evidenceTargets: locations(targets) })
  if (reversed.length) flags.push({ checkId: 'keyboard-tab-order', rubric: 'EXPERIENCE', severity: 'POLISH',
    problem: 'Positive tabindex changes the observed keyboard sequence',
    evidence: `Tab visited ${targets.slice(0, 8).map(step => step.label || step.selector).join(' → ')}. Positive tabindex caused a backward jump in document order. This is a navigation-order heuristic, not a claim about the intended reading order.`,
    fix: '1. Review the recorded sequence against the visible reading and action order.\n2. Prefer native controls and tabindex="0" over positive tabindex.\n3. Put controls in a logical DOM order and repeat Tab navigation.',
    confidence: 0.8, source: 'DETERMINISTIC', pageUrl, verificationRule, evidenceTargets: locations(targets) })
  function assertion(key: string, name: string, expected: string, observed: string, passed: boolean) {
    const targetsForAssertion = targets.map(step => ({ selector: step.selector, label: step.label || 'Keyboard control', context: scopedContext() }))
    if (!navigationComplete && passed) {
      assertions.push({ key, name, expected, observed: 'The keyboard probe stopped before this sequence was established.',
        passed: false, complete: false, targets: targetsForAssertion })
      return
    }
    assertions.push({ key, name, expected, observed, passed, complete: true, targets: targetsForAssertion })
  }
  if (targets.length) {
    focusObservations(targets)
    assertion('tab-sequence', 'Recorded keyboard order', 'The exercised Tab sequence has no positive-tabindex backward jump',
      `${reversed.length} backward jumps after positive tabindex in the recorded sequence; intended reading order still requires review.`, reversed.length === 0)
    assertion('keyboard-exit', 'Keyboard navigation exit', 'Tab can leave the recorded controls without an unresolved cycle',
      evidence.trap === 'blocked' ? 'Tab, Shift+Tab, and Escape remained in the observed cycle' : 'Document boundary reached through the complete recorded control set', evidence.trap !== 'blocked')
  }
  for (const interaction of evidence.interactions ?? []) {
    const context = scopedContext(`${interaction.kind}:${interaction.trigger.selector}=>${interaction.popup?.selector ?? 'unobserved'}`)
    const identity = { selector: interaction.trigger.selector, label: interaction.trigger.label || 'Popup trigger', context }
    const name = interaction.trigger.label || 'Popup trigger'
    const invalid = ['scanner_boundary_refused', 'interaction_interrupted', 'deadline_exhausted', 'popup_scope_unresolved'].includes(interaction.reason)
    function observe(key: string, label: string, expected: string, observed: string, passed: boolean | null) {
      assertions.push({ key, name: `${name}: ${label}`, expected, observed, passed: passed === true,
        complete: passed !== null, context, targets: [identity] })
    }
    function finding(checkId: string, problem: string, observed: string, fix: string, polish = false) {
      flags.push({ checkId, rubric: 'EXPERIENCE', severity: polish ? 'POLISH' : 'IMPORTANT', problem,
        evidence: `${name}: ${observed}`, fix, confidence: 0.95, source: 'DETERMINISTIC', pageUrl,
        verificationRule, evidenceTargets: locations([interaction.trigger], context) })
    }
    if (interaction.openedBy === 'none' || invalid) {
      observe('popup-open', 'Popup opening', 'The declared popup opens from its keyboard trigger',
        `${SITE_ACTION_COPY.execution.keyboard.interactionReasons[interaction.reason as keyof typeof SITE_ACTION_COPY.execution.keyboard.interactionReasons] ?? 'Opening was not established.'} This scope remains unverified.`, null)
      continue
    }
    const openedByKeyboard = interaction.openedBy === 'enter' || interaction.openedBy === 'space'
    observe('popup-open', 'Popup opening', 'Enter opens the declared popup',
      `The ${interaction.kind} opened using ${interaction.openedBy === 'pointer' ? 'a pointer click after keyboard opening was unavailable' : interaction.openedBy === 'space' ? 'Space after Enter did not open it' : 'Enter'}.`, interaction.openedBy === 'enter')
    if (interaction.openedBy !== 'enter') finding('keyboard-popup-opening', 'A declared popup did not open with Enter',
      `Enter did not open this ${interaction.kind}; ${interaction.openedBy === 'space' ? 'Space' : 'a pointer click'} did.`,
      '1. Use a native button for the popup trigger and keep it in the Tab sequence.\n2. Support Enter and Space through the same opening handler.\n3. Repeat the keyboard opening without activating popup actions.')
    if (openedByKeyboard) {
      observe('popup-entry', 'Focus after opening', interaction.kind === 'disclosure' ? 'Tab reaches the revealed content' : `Keyboard focus enters the opened ${interaction.kind}`,
        interaction.entry === 'inside' ? 'Focus reached the opened component.' : interaction.entry === 'outside' ? 'Focus remained outside the opened component.' : 'Entry into the opened content could not be established.',
        interaction.entry === 'unknown' ? null : interaction.entry === 'inside')
      if (interaction.entry === 'outside') finding('keyboard-popup-focus', 'Keyboard focus stayed outside an opened popup',
        `The declared ${interaction.kind} opened from the keyboard, but focus did not enter it.`,
        '1. Move focus into the opened menu or dialog.\n2. For a menu, focus a menu item or manage a valid aria-activedescendant.\n3. For a dialog, focus an appropriate control or a heading with tabindex="-1".\n4. Preserve a clear focus indicator.')
    }
    if (interaction.arrows !== 'not_applicable') {
      observe('menu-arrows', 'Menu arrow keys', 'Arrow keys move among the menu items without activating them',
        interaction.arrows === 'moved' ? 'Arrow keys moved focus among menu items.' : interaction.arrows === 'stuck' ? 'Both tested arrow directions left focus on the same item despite other items being present.' : 'Arrow-key movement could not be established.',
        interaction.arrows === 'unknown' ? null : interaction.arrows === 'moved')
      if (interaction.arrows === 'stuck') finding('keyboard-menu-navigation', 'Menu items did not respond to arrow-key navigation',
        'Neither tested arrow direction moved focus from the current menu item.',
        '1. Handle the appropriate arrow keys for the declared menu orientation.\n2. Move DOM focus or update aria-activedescendant to the next or previous item.\n3. Keep item activation separate from focus movement.')
    }
    if (interaction.containment !== 'not_applicable') {
      observe('modal-boundary', 'Modal focus boundary', 'Tab and Shift+Tab remain inside the open modal',
        interaction.containment === 'contained' ? 'The recorded modal controls were traversed and reverse navigation remained inside.' : interaction.containment === 'escaped' ? 'Tab or Shift+Tab moved focus to page content outside the still-open modal.' : 'The modal focus boundary was not fully exercised.',
        interaction.containment === 'unknown' ? null : interaction.containment === 'contained')
      if (interaction.containment === 'escaped') finding('keyboard-modal-boundary', 'Keyboard focus escaped an open modal',
        'Tab or Shift+Tab focused background content while the declared modal stayed open.',
        '1. Make background content inert while the modal is open.\n2. Keep Tab and Shift+Tab within the modal controls.\n3. Restore normal page focus navigation when the modal closes.')
    }
    if (interaction.kind !== 'disclosure') {
      observe('popup-escape', 'Escape handling', 'Escape dismisses the opened menu or dialog',
        interaction.escape === 'closed' ? 'Escape closed the opened component.' : interaction.escape === 'remained' ? 'The opened component remained visible after Escape.' : 'Escape dismissal could not be established.',
        interaction.escape === 'unknown' ? null : interaction.escape === 'closed')
      if (interaction.escape === 'remained') finding('keyboard-popup-escape', 'Escape did not dismiss an opened popup',
        `The declared ${interaction.kind} remained open after Escape. No action or submission control was activated.`,
        '1. Support Escape for dismissible menus and dialogs.\n2. Provide a reachable close or cancel control.\n3. If a dialog must remain open for a required workflow, review that choice and ensure keyboard users have a clear way to leave.', true)
      if (interaction.escape === 'closed') {
        observe('focus-restoration', 'Focus after dismissal', 'Dismissal returns focus to the invoking control or a reviewed workflow destination',
          interaction.restoration === 'trigger' ? 'Focus returned to the original trigger.' : interaction.restoration === 'lost' ? 'The trigger still existed, but focus was lost to the document or an invisible target.' : 'Focus moved to a different destination or the trigger was removed. The workflow needs review.',
          interaction.restoration === 'trigger' ? true : interaction.restoration === 'lost' ? false : null)
        if (interaction.restoration === 'lost') finding('keyboard-focus-restoration', 'Focus was lost after dismissing a popup',
          'Escape closed the popup, but focus did not return to the still-visible trigger or another visible workflow control.',
          '1. Keep a reference to the trigger when opening the popup.\n2. After closing, return focus to that trigger if it still exists.\n3. If the trigger was removed, choose a logical visible destination in the workflow.\n4. Verify the result with Escape before manually moving focus.')
      }
    }
    const missingStyles = interaction.steps.filter(step => step.indicator === 'missing')
    if (missingStyles.length) flags.push({ checkId: 'focus-visible-missing', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Keyboard controls in an opened popup have no observed focus indicator',
      evidence: `${name}: focus reached ${missingStyles.map(step => step.label).join(', ')} inside the opened ${interaction.kind}, without a visible outline or recorded focus-style change.`,
      fix: '1. Preserve the popup design and add a clear :focus-visible style to the recorded controls.\n2. Test the styles after opening the same popup with the keyboard.\n3. Repeat its navigation and dismissal.',
      confidence: 0.9, source: 'DETERMINISTIC', pageUrl, verificationRule, evidenceTargets: locations(missingStyles, context) })
    focusObservations(interaction.steps, context, `${name}: exercised popup focus styles`)
  }
  // A page can have several failures with the same check identity. Preserve all
  // their contexts before the existing page-level finding collapse runs.
  const grouped = new Map<string, DeterministicFlag>()
  for (const flag of flags) {
    const prior = grouped.get(flag.checkId)
    if (!prior) grouped.set(flag.checkId, flag)
    else {
      prior.evidence += '\n' + flag.evidence
      prior.evidenceTargets = [...(prior.evidenceTargets ?? []), ...(flag.evidenceTargets ?? [])]
      if (flag.checkId === 'focus-visible-missing') prior.problem = `${prior.evidenceTargets.length} exercised keyboard controls have no observed focus indicator`
    }
  }
  return { flags: [...grouped.values()], assertions }
}
