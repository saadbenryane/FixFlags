/** Missing comparison evidence must never sound like a verified recovery. */
export const VERIFICATION_EVIDENCE_COPY = {
  UNREADABLE_RECHECK: "This recheck's recorded scope could not be read. The original finding remains unverified.",
  UNMEASURED: 'This recommendation has no measurable condition that this recheck can independently verify. Review the new evidence before deciding whether the change addresses it.',
  UNREADABLE: 'The original supporting evidence could not be read. This recheck cannot establish a verified recovery.',
  INCOMPLETE_ORIGINAL: 'The original evidence is missing its recorded source, scope, or check version. This recheck cannot establish a verified recovery.',
  MISSING_CHECK: 'This recheck did not include every check from the original finding. The finding remains unverified.',
  METHOD_CHANGED: 'The check method changed after the original observation. This recheck cannot prove that the original condition is resolved.',
} as const

export const EDITOR_EVIDENCE_COPY = {
  title: 'Recorded supporting observations:',
  page: 'Page', source: 'Source', check: 'Check', version: 'Version', recordedAt: 'Recorded at', evidence: 'Evidence', target: 'Target',
  unknown: 'Not recorded',
  verifyAll: 'Recheck every recorded supporting observation on its original page and device. Missing or unavailable evidence does not establish a passed check.',
  unreadable: 'The recorded supporting evidence could not be read. Recheck the affected page before preparing a fix.',
} as const

export const JOURNEY_ROUTE_COPY = {
  destinationAction: {
    problem: "Review the destination's primary action",
    evidence: (target: string) => `Recorded at step 2. After opening "${target}", no recognized primary CTA was detected. Other navigation or controls may still be available.`,
    whyItMatters: 'Review the existing controls in the context of the page purpose and intended audience before deciding whether another action is needed.',
    fix: '1. Review the destination and its existing controls against the page purpose.\n2. If a primary action is needed, make the appropriate existing or new control clear and accessible.\n3. Recheck the recorded destination and review its context.',
  },
  entryAction: {
    problem: "Review the entry page's primary action",
    evidence: 'Recorded at step 1. No recognized primary CTA was detected in the checked viewport. Other navigation or controls may still be available.',
    whyItMatters: 'Review the recorded controls and page purpose before deciding whether a primary action is needed. Visitor continuation was not measured by this recognizer.',
    fix: '1. Review the existing navigation and controls against the page purpose.\n2. If a primary action is needed, make the appropriate control clear and accessible.\n3. Recheck the original viewport and intended route.',
  },
  signupMechanism: {
    problem: 'Review the signup mechanism',
    evidence: 'Recorded at step 2. No visible editable fields were recorded at the signup destination. An external provider or another registration control may still be available.',
    whyItMatters: 'Review the intended registration mechanism and its actual behavior before deciding whether a form is needed. This field count does not establish whether registration works.',
    fix: '1. Inspect the destination and identify its intended registration mechanism.\n2. If the intended mechanism is unavailable, restore it and make its control clear and accessible.\n3. Check the actual registration journey with authorized account checks before claiming successful signup.',
  },
  contactMechanism: {
    problem: 'Review the contact mechanism',
    evidence: 'Recorded at step 2. No recognized contact wording or visible editable fields were detected at the destination. Telephone, messaging, or other contact controls may still be available.',
    whyItMatters: 'Review the available contact methods and page purpose. This wording and field check does not establish whether visitors can obtain help.',
    fix: '1. Review the destination and its existing contact methods.\n2. If the intended contact mechanism is unavailable, restore it and explain how to use it.\n3. Check that mechanism before claiming a completed support request.',
  },
  repeatedNavigation: {
    problem: 'Review the repeated navigation',
    evidence: (step: number, url: string, visits: number) => `Recorded at step ${step}. URL ${url} was visited ${visits} times during this walk. The plan may intentionally revisit a page.`,
    whyItMatters: 'Inspect the recorded route and intended task to determine whether the return was expected. A repeated URL alone does not establish that a visitor is trapped.',
    fix: '1. Review the recorded steps and any planned revisits.\n2. If a return is unintended and prevents progress, correct the affected navigation.\n3. Recheck the intended task through its actual completion.',
  },
  continuationRouteNotSelected: 'No eligible continuation link was selected from the recorded page. This route check did not activate unlinked controls or establish whether another action can continue.',
  contactRouteNotSelected: 'No matching contact or help route was selected from the recorded links. This route check does not establish whether a contact method is available on the page.',
} as const
