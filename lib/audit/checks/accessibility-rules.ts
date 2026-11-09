import type { CheckAssertion } from './assertion'

export type AxeTarget = Array<string | string[]>
export const AXE_DOCUMENT_SCOPE_CONTEXT = 'same-origin-v2'
export const AXE_EMBEDDED_SCOPE_CONTEXT = ':embedded-v1:'
export const AXE_FRAME_SELECTOR_SEPARATOR = ' ::frame '

/** Outer entries cross frame documents; nested entries cross shadow roots.
 * The iframe element itself still belongs to the top document. */
export function isIframeAxeTarget(target: ReadonlyArray<string | readonly string[]> | undefined): boolean {
  return Boolean(target && target.length > 1)
}

export function axeTargetSelector(target: ReadonlyArray<string | readonly string[]>): string {
  return target.map(part => typeof part === 'string' ? part : part.join(' >>> ')).join(AXE_FRAME_SELECTOR_SEPARATOR)
}

/** Portable inventory of the installed axe WCAG policy. Runtime results retain actual rule outcomes. */
export const ACCESSIBILITY_TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa']
export const MOBILE_ACCESSIBILITY_RULE_IDS = ['target-size'] as const
// Explicit registered responsibilities outside the WCAG tag selection.
// duplicate-id-active is retained as a legacy control-identifier diagnostic.
export const ACCESSIBILITY_ADDITIONAL_RULE_IDS = ['duplicate-id-active', 'heading-order', 'landmark-banner-is-top-level',
  'landmark-contentinfo-is-top-level', 'landmark-main-is-top-level', 'landmark-no-duplicate-banner',
  'landmark-one-main', 'page-has-heading-one'] as const
export const ACCESSIBILITY_RUN_OPTIONS = {
  runOnly: { type: 'tag' as const, values: ACCESSIBILITY_TAGS },
  rules: Object.fromEntries(ACCESSIBILITY_ADDITIONAL_RULE_IDS.map(id => [id, { enabled: true }])),
}
export const ACCESSIBILITY_DOM_CHECK_IDS = ['images-missing-alt', 'form-inputs-no-label', 'buttons-no-text', 'links-no-text', 'iframe-no-title', 'tabindex-positive', 'skip-link-missing'] as const
export const HTML_CONTROL_NAMES_VERSION = 2
export const HTML_CONTROL_NAME_CHECK_IDS = ['form-inputs-no-label', 'buttons-no-text', 'links-no-text'] as const
export const HTML_CONTROL_NAMES_CONTEXT = ':html-control-names-v' + HTML_CONTROL_NAMES_VERSION

/** Older counters remain recorded observations, not current positive name proof. */
export function currentControlNameObservation(assertion: { key: string; passed: boolean; context?: string }): boolean {
  return !HTML_CONTROL_NAME_CHECK_IDS.some(id => assertion.key === 'dom:' + id) || !assertion.passed ||
    assertion.context?.endsWith(HTML_CONTROL_NAMES_CONTEXT) === true
}

type AccessibilityAssertion = Pick<CheckAssertion, 'key' | 'passed' | 'complete' | 'context'>

/** A positive HTML count cannot settle a native result for the same
 * responsibility and capture. Other devices and rules remain independent. */
export function currentAccessibilityObservation(assertion: AccessibilityAssertion, siblings: readonly AccessibilityAssertion[]): boolean {
  if (!currentControlNameObservation(assertion)) return false
  if (!assertion.passed || !assertion.key.startsWith('dom:')) return true
  const scope = assertion.context?.match(/^accessibility:dom:(desktop|mobile):([a-f0-9]{64}):/)
  if (!scope) return true
  const checkId = assertion.key.slice(4)
  const nativeScope = `accessibility:axe:${scope[1]}:${scope[2]}:${checkId}:`
  return !siblings.some(item => item.key === 'axe:' + checkId && item.context?.startsWith(nativeScope) &&
    (!item.passed || item.complete !== true))
}
export const AXE_POLICY_RULE_IDS = [
  'area-alt',
  'aria-allowed-attr',
  'aria-braille-equivalent',
  'aria-command-name',
  'aria-conditional-attr',
  'aria-deprecated-role',
  'aria-hidden-body',
  'aria-hidden-focus',
  'aria-input-field-name',
  'aria-meter-name',
  'aria-progressbar-name',
  'aria-prohibited-attr',
  'aria-required-attr',
  'aria-required-children',
  'aria-required-parent',
  'aria-roledescription',
  'aria-roles',
  'aria-tab-name',
  'aria-toggle-field-name',
  'aria-tooltip-name',
  'aria-valid-attr',
  'aria-valid-attr-value',
  'audio-caption',
  'blink',
  'button-name',
  'bypass',
  'color-contrast',
  'definition-list',
  'dlitem',
  'document-title',
  'duplicate-id-aria',
  'form-field-multiple-labels',
  'frame-focusable-content',
  'frame-title',
  'frame-title-unique',
  'html-has-lang',
  'html-lang-valid',
  'html-xml-lang-mismatch',
  'image-alt',
  'input-button-name',
  'input-image-alt',
  'label',
  'link-in-text-block',
  'link-name',
  'list',
  'listitem',
  'marquee',
  'meta-refresh',
  'meta-viewport',
  'nested-interactive',
  'no-autoplay-audio',
  'object-alt',
  'p-as-heading',
  'role-img-alt',
  'scrollable-region-focusable',
  'select-name',
  'server-side-image-map',
  'summary-name',
  'svg-img-alt',
  'table-fake-caption',
  'target-size',
  'td-has-header',
  'td-headers-attr',
  'th-has-data-cells',
  'valid-lang',
  'video-caption',
] as const
export const AXE_RULE_CHECK_IDS = {
  'color-contrast': 'color-contrast-poor',
  'image-alt': 'images-missing-alt',
  'input-image-alt': 'images-missing-alt',
  'label': 'form-inputs-no-label',
  'select-name': 'form-inputs-no-label',
  'button-name': 'buttons-no-text',
  'link-name': 'links-no-text',
  'frame-title': 'iframe-no-title',
  'frame-title-unique': 'iframe-no-title',
  'tabindex': 'tabindex-positive',
  'bypass': 'skip-link-missing',
  'region': 'skip-link-missing',
  'focus-order-semantics': 'focus-visible-missing',
  'aria-required-children': 'axe-aria-required-children',
  'aria-required-parent': 'axe-aria-required-parent',
  'duplicate-id-active': 'axe-duplicate-id-active',
  'duplicate-id-aria': 'axe-duplicate-id-aria',
  'heading-order': 'heading-order-skipped',
  'landmark-banner-is-top-level': 'axe-landmark-banner',
  'landmark-contentinfo-is-top-level': 'axe-landmark-contentinfo',
  'landmark-main-is-top-level': 'axe-landmark-main',
  'landmark-no-duplicate-banner': 'axe-landmark-duplicate',
  'landmark-one-main': 'axe-landmark-one-main',
  'page-has-heading-one': 'axe-missing-h1',
  'list': 'axe-list-structure',
  'listitem': 'axe-list-structure',
  'meta-viewport': 'axe-meta-viewport',
} as const
type AxeCheckId<T extends string> = string extends T ? string : T extends keyof typeof AXE_RULE_CHECK_IDS ? typeof AXE_RULE_CHECK_IDS[T] : `axe-${T}`
export function axeRuleToCheckId<T extends string>(axeId: T): AxeCheckId<T> {
  return ((AXE_RULE_CHECK_IDS as Readonly<Record<string, string>>)[axeId] ?? 'axe-' + axeId) as AxeCheckId<T>
}
export const AXE_POLICY_CHECK_IDS = [...new Set([...AXE_POLICY_RULE_IDS, ...Object.keys(AXE_RULE_CHECK_IDS) as Array<keyof typeof AXE_RULE_CHECK_IDS>].map(id => axeRuleToCheckId(id)))]
export const ACCESSIBILITY_VERIFICATION_RULE = 'Accessibility observation: repeat the recorded desktop rule responsibilities on every affected page with the same requested and final URLs, capture profile, access conditions and engine policy. Missing rules, unresolved results and unavailable captures cannot certify recovery.'

export function isComparableAccessibilityContext(context: string): boolean {
  return context.startsWith('accessibility:') && !context.includes(':unknown:')
}
