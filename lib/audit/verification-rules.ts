import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'

/** Client-safe lookup - no server-only audit imports. */
export const CHECK_ID_TO_RULE: Record<string, string> = {
  'title-missing':
    'View page source or DevTools Elements, confirm a non-empty <title> tag.',
  'title-too-short':
    'Confirm the title is at least 10 characters and describes the page.',
  'title-too-long':
    'Confirm the title is 60 characters or fewer in search preview.',
  'description-missing':
    'View page source, confirm meta name="description" with content.',
  'description-too-short':
    'Confirm the meta description is at least 50 characters.',
  'description-too-long':
    'Confirm the meta description is 160 characters or fewer.',
  'og-image-missing':
    'View page source for og:image; open the image URL in a new tab (should return 200).',
  'og-image-broken':
    'Open the og:image URL in a new tab; it should return 200 with a valid image.',
  'og-title-missing': 'View page source, confirm meta property="og:title" is present.',
  'og-description-missing':
    'View page source, confirm meta property="og:description" is present.',
  'viewport-missing':
    'View page source, confirm meta name="viewport" with width=device-width.',
  'lang-missing': 'Confirm the <html> element has a lang attribute.',
  'canonical-missing': 'View page source, confirm link rel="canonical" points to this page.',
  'robots-blocks-indexing':
    'View page source, confirm robots meta does not include noindex.',
  'favicon-missing':
    'Confirm link rel="icon" or apple-touch-icon exists and the icon loads in the browser tab.',
  'checkout-link-dead':
    'Click each checkout/payment link; confirm it loads a working payment page (no 404 or server error).',
  'auth-page-broken':
    'Click the login/sign-up link; confirm the auth page renders without a 404 or server error.',
  'competing-ctas':
    'On mobile, confirm there is one clear primary CTA above the fold; demote competing buttons to secondary styling.',
  'perf-score-critical':
    'Run PageSpeed Insights; desktop performance score should be 50 or above.',
  'perf-score-poor':
    'Run PageSpeed Insights; desktop performance score should reach 75 or above.',
  'lcp-critical':
    'Chrome DevTools Lighthouse or PageSpeed Insights, LCP should be under 2.5s.',
  'lcp-poor':
    'Chrome DevTools Lighthouse or PageSpeed Insights, LCP should be under 2.5s.',
  'cls-critical': 'Lighthouse CLS should be 0.1 or lower.',
  'cls-poor': 'Lighthouse CLS should be 0.1 or lower.',
  'render-blocking':
    'Chrome DevTools Network, filter JS/CSS; blocking resources should not delay first paint.',
  'unused-js-large':
    'Chrome DevTools Coverage tab, unused JavaScript should be under 200KB.',
  'unused-css-large':
    'Chrome DevTools Coverage tab, unused CSS should be materially reduced.',
  'unoptimized-images':
    'Lighthouse should no longer flag unoptimized or non-modern image formats.',
  'inp-critical': 'PageSpeed Insights mobile INP should be 200ms or lower.',
  'inp-poor': 'PageSpeed Insights mobile INP should be 200ms or lower.',
  'images-missing-alt':
    'DevTools Elements, every informational img has a non-empty alt attribute.',
  'form-inputs-no-label':
    'Every visible input has an associated label or aria-label.',
  'buttons-no-text':
    'Every button has visible text or aria-label describing its action.',
  'links-no-text':
    'Every link has visible text, aria-label, or title describing the destination.',
  'iframe-no-title': 'Every iframe has a descriptive title attribute.',
  'tabindex-positive': 'No elements use tabindex greater than 0.',
  'color-contrast-poor':
    'Lighthouse accessibility audit for color-contrast should pass with no failing nodes.',
  'skip-link-missing':
    'Tab from the top of the page; first focusable element should be a skip-to-content link.',
  'keyboard-nav-trap':
    'Tab through modals and overlays; focus should not become stuck and Escape should close.',
  'focus-visible-missing':
    'Tab through interactive elements; each should show a visible focus indicator.',
  'axe-aria-required-children':
    'Run axe DevTools; ensure ARIA role elements contain the required child elements per spec.',
  'axe-aria-required-parent':
    'Run axe DevTools; ensure elements with ARIA roles are contained within required parent roles.',
  'axe-duplicate-id-active':
    'Run axe DevTools; ensure no active HTML elements share the same id attribute value.',
  'axe-duplicate-id-aria':
    'Run axe DevTools; ensure no ARIA IDs are duplicated in the accessibility tree.',
  'axe-landmark-banner':
    'Run axe DevTools; ensure the banner landmark is a top-level landmark.',
  'axe-landmark-contentinfo':
    'Run axe DevTools; ensure the contentinfo landmark is a top-level landmark.',
  'axe-landmark-main':
    'Run axe DevTools; ensure the main landmark is a top-level landmark.',
  'axe-landmark-duplicate':
    'Run axe DevTools; ensure banner landmark is not duplicated.',
  'axe-landmark-one-main':
    'Run axe DevTools; ensure exactly one main landmark is present on the page.',
  'axe-missing-h1':
    'Run axe DevTools; ensure the page contains at least one heading level 1 element.',
  'axe-list-structure':
    'Run axe DevTools; ensure list elements contain only li elements and script/supporting elements.',
  'axe-meta-viewport':
    'Run axe DevTools; ensure the viewport meta tag disables user scaling for accessibility.',
  'h1-missing': 'DevTools Elements, confirm exactly one visible H1 on the page.',
  'h1-multiple': 'DevTools Elements, confirm only one H1; secondary headings should be H2/H3.',
  'no-structured-data':
    'View page source for script type="application/ld+json" or validate in Rich Results Test.',
  'sitemap-missing': 'Open /sitemap.xml; it should return 200 with valid XML.',
  'robots-txt-missing': 'Open /robots.txt; it should return 200.',
  'broken-internal-links':
    'Click or HEAD each flagged internal URL; all should return 200.',
  'broken-page-anchors':
    'Click each flagged hash link; the target section should exist on the page.',
  'no-https': 'Open the site URL, address bar should show HTTPS with a valid certificate.',
  'no-privacy-policy':
    'Footer or legal links should include a privacy policy reachable in one click.',
  'no-contact-info':
    'Footer or header should include email, contact form, or social links.',
  'cookie-consent-absent':
    'If analytics scripts load, a cookie consent banner should appear for EU visitors.',
  'console-errors-critical':
    'Chrome DevTools Console should show zero errors on page load.',
  'console-errors-some':
    'Chrome DevTools Console should show zero errors on page load.',
  'mobile-perf-critical':
    'PageSpeed Insights mobile performance score should be 50 or above.',
  'mobile-perf-poor':
    'PageSpeed Insights mobile performance score should reach 75 or above.',
  'tap-targets-small':
    'At 375px width, tap targets should be at least 48x48px with adequate spacing.',
  'mobile-lcp-critical':
    'PageSpeed Insights mobile LCP should be under 2.5s.',
  'h1-generic':
    'H1 should describe a specific product outcome, not a generic welcome or AI-builder category headline.',
  'heading-hierarchy-missing':
    'Add H2 section headings so visitors can scan features, pricing, and proof without reading every paragraph.',
  'no-cta-detected':
    'A primary CTA button or link should be visible above the fold.',
  'cta-below-fold-mobile':
    'Chrome DevTools at 375×812: primary CTA button visible without scrolling.',
  'loading-indicator-stuck':
    'After page load, no skeleton, spinner, or aria-busy overlay should remain visible over the hero.',
  'loading-state-slow':
    'Throttle the page in Chrome DevTools; the first screen should swap from loading UI to real content within 3 seconds.',
  'motion-ignores-reduced-preference':
    'Enable prefers-reduced-motion in OS settings; hero animations and loops should stop or shorten to near-zero.',
  'placeholder-copy-detected':
    'Page should not contain Lorem ipsum, TODO, TBD, or [object Object] in visible text.',
  'template-default-copy':
    'Replace generic template phrases like "Welcome to" or "Your Company" with product-specific copy.',
  'unreplaced-template-token':
    'No {{token}}, ${var}, or %VAR% placeholders should appear in rendered page text.',
  'cta-dead-link':
    'Primary CTA links should not use href="#" or empty href; point to a real destination URL.',
  'social-proof-unverifiable':
    'Remove fake stats and placeholder testimonials, or replace with verifiable proof.',
  'flow-no-cta-found':
    'A clickable primary CTA should be visible in the desktop viewport.',
  'flow-cta-unclickable':
    'The primary CTA should be clickable without being obscured by overlays.',
  'overlay-blocks-nav':
    'With any modal or sticky ad present, primary nav links remain clickable or the overlay offers a clear dismiss control.',
  'overlay-blocks-cta':
    'Click the primary CTA; no overlay or sticky unit should intercept the click.',
  'overlay-blocks-form':
    'Form checkboxes and inputs remain clickable; sticky ads must not cover the control.',
  'api-engagement-unauthorized':
    'Submit newsletter/signup/contact with valid input; the API should not return 401/403 for a public engagement path.',
  'api-engagement-server-error':
    'Submit the engagement form; the API should return success or a clear 4xx validation error, not 5xx.',
  'form-submit-api-unauthorized':
    'Complete the form and submit; the request should authenticate correctly for public signup/newsletter/contact.',
  'form-submit-api-server-error':
    'Submit the form; the server should accept or validate without a 5xx response.',
  'form-submit-silent-failure':
    'After a successful submit, show clear confirmation; never show success when the API failed.',
  'flow-cta-404':
    'Clicking the primary CTA should not navigate to a 4xx or 5xx page.',
  'flow-cta-dead-end':
    'Clicking the primary CTA should navigate or update the page meaningfully.',
  'flow-cta-external-leave':
    'Primary CTA should lead to signup, pricing, or contact on your domain when possible.',
  'flow-pricing-nav-broken':
    'Click the Pricing nav link; it should scroll to a #pricing section or open a /pricing page.',
  'flow-mobile-menu-broken':
    'At 375px width, open the menu toggle; nav links should become visible and tappable.',
  'flow-form-no-validation':
    'Submit the signup/contact form empty; inline errors or browser validation should appear.',
  'form-missing-validation':
    'Inspect form fields; required/aria-required/pattern attributes should be present on each mandatory field.',
  'flow-cta-blank-destination':
    'Click the primary CTA; destination content should appear within 3 seconds with no long blank screen.',
  'flow-cta-stuck-loading':
    'After CTA navigation, skeletons or spinners should disappear once real content loads.',
  'scroll-ghost-sections':
    'Scroll the page; sections should become visible when they enter the viewport.',
  'flow-form-slow-feedback':
    'Submit an empty form; validation feedback should appear within 1 second.',
  'flow-cta-destination-no-trust':
    'The CTA destination should include privacy policy and contact information.',
  'slow-3g-blank-screen':
    'On throttled 3G, meaningful content should appear within 5 seconds.',
  'slow-3g-cta-delayed':
    'On throttled 3G, the primary CTA should be visible within 8 seconds.',
  'flow-destination-no-headline':
    'The CTA destination page should have a clear headline that reinforces the CTA promise.',
  'flow-destination-no-cta':
    'After clicking a CTA, the destination page should have a clear next action for the user.',
  'flow-cta-message-mismatch':
    'The CTA text and destination page headline should communicate the same offer.',
  'flow-destination-cta-overload':
    'The destination page should have one primary CTA, not multiple competing calls-to-action.',
  'flow-destination-stuck-loading':
    'After CTA navigation, the destination should show real content within 2 seconds, not persistent loading UI.',
  'flow-destination-no-privacy':
    'If a form collects personal information, a privacy policy link must be visible nearby.',
  'flow-destination-slow-load':
    'The destination page should show meaningful content within 3 seconds on desktop.',
}

/**
 * Verification rule for measurement scan
 */
export const MEASUREMENT_VERIFICATION_RULES = {
  'measurement-ga-gtm-posthog-missing':
    'Check Google Analytics 4, Google Tag Manager, or PostHog presence. Install one of them for conversion tracking and business intelligence.',
}

/**
 * Verification rule for security scan
 */
export const SECURITY_VERIFICATION_RULES = {
  'security-mixed-content':
    'Update all HTTP URLs to HTTPS. Replace HTTP resources in HTML/CSS/JS with HTTPS versions. Use relative URLs when possible.',
  'security-csp-missing':
    'Open DevTools Network tab, reload the page, click any document request and inspect Response Headers for Content-Security-Policy.',
  'security-csp-unsafe-inline':
    'In the CSP header, replace unsafe-inline with a nonce or hash for inline scripts.',
  'security-hsts-missing':
    'Open DevTools Network tab, find the document response, check for Strict-Transport-Security header.',
  'security-hsts-too-short':
    'Increase max-age in Strict-Transport-Security to at least 31536000 (1 year).',
  'security-frame-options-missing':
    'Open DevTools Network tab, check for X-Frame-Options header; add DENY or SAMEORIGIN.',
  'security-frame-options-too-permissive':
    'Change X-Frame-Options to DENY (preferred) or SAMEORIGIN.',
  'security-content-type-options-missing':
    'Open DevTools Network tab, check for X-Content-Type-Options: nosniff.',
  'security-headers-missing':
    'Open DevTools Network tab, reload the page, and verify Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, and X-Content-Type-Options headers are all present.',
  'security-csp-unsafe-eval':
    'In the CSP header, remove unsafe-eval and replace with specific script hashes or nonces.',
  'security-csp-weak-object-src':
    'Set the CSP object-src directive to \'none\' to prevent plugin-based attacks.',
  'security-csp-report-only':
    'Replace Content-Security-Policy-Report-Only with Content-Security-Policy for enforcement.',
  'security-hsts-no-subdomains':
    'Add includeSubDomains to the Strict-Transport-Security header.',
  'security-hsts-no-preload':
    'Add preload to the Strict-Transport-Security header and submit to HSTS preload list.',
  'security-referrer-policy-missing':
    'Add a Referrer-Policy header (e.g. strict-origin-when-cross-origin) to limit referrer leakage.',
  'security-referrer-policy-weak':
    'Strengthen Referrer-Policy to strict-origin-when-cross-origin or no-referrer.',
  'security-coop-missing':
    'Add Cross-Origin-Opener-Policy: same-origin to prevent cross-origin attacks via window.opener.',
  'security-coep-missing':
    'Add Cross-Origin-Embedder-Policy: require-corp to enable cross-origin isolation.',
  'security-corp-missing':
    'Add Cross-Origin-Resource-Policy: same-origin to control which sites can load your resources.',
  'security-permissions-policy-missing':
    'Add a Permissions-Policy header to disable or limit browser features (camera, microphone, geolocation).',
  'security-permissions-policy-overbroad':
    'Restrict Permissions-Policy to only required origins; set unused features to \'none\'.',
  'security-x-permitted-cross-domain':
    'Add X-Permitted-Cross-Domain-Policies: none to restrict Adobe Flash/flex cross-domain requests.',
}

export const SEARCH_PERFORMANCE_VERIFICATION_RULES: Record<string, string> = {
  'indexing-failure':
    'Open Google Search Console > Pages and check coverage for this URL. Submit to index and address reported issues.',
  'soft-404':
    'Confirm the page returns meaningful content (not a thin or empty page). Add 200-300 words of unique content or return a proper 404 status.',
  'robots-blocked':
    'Check robots.txt for a Disallow directive targeting this page. Remove the directive to allow crawling.',
  'noindex-meta':
    'View page source and remove the noindex robots meta tag. Verify with URL Inspection in Google Search Console.',
  'canonical-mismatch':
    'Set your canonical tag to match Google-selected canonical, or fix the signals causing the mismatch.',
  'low-ctr':
    'Rewrite the page title and meta description to be more compelling. Include the target keyword and a clear value proposition.',
}

/**
 * Verification rule for visual polish scan
 */
export const VISUAL_POLISH_VERIFICATION_RULES = {
  'visual-radius-inconsistent':
    'Pick one button radius token (e.g. 8px or 9999px pill) and apply it to every primary and secondary CTA.',
  'visual-typography-sprawl':
    'Limit to 2 font families (sans-serif for body, serif or custom for headings). Follow H1 > H2 > H3 sizing hierarchy.',
}

export const MESSAGING_CLARITY_VERIFICATION_RULES: Record<string, string> = {
  'messaging-weak-value-prop':
    'Open the page and check that the headline names a specific outcome, not just a product category. Does it pass the "so what?" test?',
  'messaging-jargon-overload':
    'Scan the visible headings. Replace every jargon word (leverage, utilize, empower, etc.) with plain language. Read aloud to confirm.',
  'messaging-no-audience':
    'Check that the headline or subhead identifies the target audience ("for X"). Add one if missing.',
  'messaging-long-sentences':
    'Read the body copy aloud. Break any sentence where you run out of breath. Aim for 15-20 words max.',
  'messaging-headline-too-short':
    'Expand the headline to 5-10 words that name the product, audience, and outcome. Check it communicates value in under 3 seconds.',
}

export const CONVERSION_FRICTION_VERIFICATION_RULES: Record<string, string> = {
  'friction-no-commitment-path':
    'Add a free trial CTA, demo booking, or visible pricing link so visitors have a clear next step. Verify the link works end-to-end.',
  'friction-trial-commitment-unclear':
    'Add "no credit card required" text near the trial CTA. Confirm it is visible without scrolling.',
  'friction-form-too-many-fields':
    'Count the form fields. Remove any that are not essential for first contact (keep to 3-4 max).',
  'friction-no-risk-reversal':
    'Add a guarantee, "free trial" mention, or "cancel anytime" note near the primary CTA.',
  'friction-no-social-proof':
    'Add customer count, testimonial, or review badge near the CTA section. Position it so it is visible without scrolling past the CTA.',
}

export const TRUST_PSYCHOLOGY_VERIFICATION_RULES: Record<string, string> = {
  'trust-no-authority-signals':
    'Add media logos, press mentions, certification badges, or investor logos near the hero or above the CTA.',
  'trust-testimonial-quality':
    'Use testimonials with real name, title, and company. Quotes should be 40+ characters with specific results.',
  'trust-unsupported-claims':
    'Replace each absolute claim ("the best", "the fastest") with specific, verifiable data ("4.2x faster than X").',
  'trust-no-direct-contact':
    'Add an email address in the footer, a contact link in the nav, or a live chat widget.',
  'trust-no-internal-links':
    'Add navigation links to key pages (features, pricing, docs, blog) in the header and footer.',
}

export const VISUAL_HIERARCHY_VERIFICATION_RULES: Record<string, string> = {
  'hierarchy-competing-actions':
    'Make one CTA dominant (filled, larger). Demote others to ghost/outline styling. Remove non-essential CTAs from above the fold.',
  'hierarchy-no-sections':
    'Add H2 section headings to break content into scannable sections with descriptive labels.',
  'hierarchy-no-headline':
    'Add an H1 element at the top of the main content that names the product and outcome.',
  'hierarchy-information-density':
    'Simplify above-the-fold content. Reduce heading word count. Add whitespace between key sections.',
}

export const MOBILE_UX_VERIFICATION_RULES: Record<string, string> = {
  'mobile-input-zoom':
    'Set font-size to 16px minimum on all input, textarea, and select elements. Test on iOS Safari.',
  'mobile-cta-thumb-zone':
    'Keep the CTA out of the top reach zone or add sticky bottom positioning. One-hand test on a 6.7" phone.',
  'mobile-cta-weak-label':
    'Replace vague CTA text with outcome-specific action text (e.g. "Start free trial" not "Click here").',
  'mobile-load-delay-content':
    'Test on 3G. Confirm meaningful content renders within 2 seconds. Server-render hero content.',
}

const JOURNEY_VERIFY =
  'Re-run the journey in an incognito window on desktop and mobile. Confirm the goal page loads with a clear next action and no dead ends.'

export const JOURNEY_VERIFICATION_RULES: Record<string, string> = {
  'journey-first-visit-unclear-value-prop': JOURNEY_VERIFY,
  'journey-first-visit-hidden-cta': JOURNEY_VERIFY,
  'journey-first-visit-dead-end': JOURNEY_VERIFY,
  'journey-first-visit-nav-broken': JOURNEY_VERIFY,
  'journey-first-visit-destination-no-headline': JOURNEY_VERIFY,
  'journey-first-visit-destination-no-next-action': JOURNEY_VERIFY,
  'journey-pricing-evaluation-unclear-value-prop': JOURNEY_VERIFY,
  'journey-pricing-evaluation-hidden-cta': JOURNEY_VERIFY,
  'journey-pricing-evaluation-dead-end': JOURNEY_VERIFY,
  'journey-pricing-evaluation-nav-broken': JOURNEY_VERIFY,
  'journey-pricing-evaluation-destination-no-headline': JOURNEY_VERIFY,
  'journey-pricing-evaluation-destination-no-next-action': JOURNEY_VERIFY,
  'journey-signup-unclear-value-prop': JOURNEY_VERIFY,
  'journey-signup-hidden-cta': JOURNEY_VERIFY,
  'journey-signup-dead-end': JOURNEY_VERIFY,
  'journey-signup-nav-broken': JOURNEY_VERIFY,
  'journey-signup-no-form': JOURNEY_VERIFY,
  'journey-signup-too-many-fields': JOURNEY_VERIFY,
  'journey-contact-not-found': JOURNEY_VERIFY,
  'journey-funnel-step-failed': JOURNEY_VERIFY,
  'journey-funnel-loop-detected': JOURNEY_VERIFY,
  'journey-funnel-timeout': JOURNEY_VERIFY,
  'journey-funnel-dead-end': JOURNEY_VERIFY,
  'journey-funnel-friction': JOURNEY_VERIFY,
  'journey-funnel-confusion': JOURNEY_VERIFY,
  'journey-funnel-broken-promise': JOURNEY_VERIFY,
  'journey-funnel-accessibility-barrier': JOURNEY_VERIFY,
  'journey-funnel-misleading-ux': JOURNEY_VERIFY,
  'journey-funnel-missing-feedback': JOURNEY_VERIFY,
  'journey-funnel-unclear-progress': JOURNEY_VERIFY,
  'journey-funnel-too-many-steps': JOURNEY_VERIFY,
  'corridor-og-title-drift':
    'Align og:title with the page H1/title. Share the URL in a private Slack/iMessage preview and confirm the title matches.',
  'corridor-og-description-drift':
    'Align og:description with the page value prop. Share the URL in a private preview and confirm the description matches.',
}

export const ALL_VERIFICATION_RULES: Record<string, string> = {
  ...CHECK_ID_TO_RULE,
  ...MEASUREMENT_VERIFICATION_RULES,
  ...SECURITY_VERIFICATION_RULES,
  ...VISUAL_POLISH_VERIFICATION_RULES,
  ...MESSAGING_CLARITY_VERIFICATION_RULES,
  ...CONVERSION_FRICTION_VERIFICATION_RULES,
  ...TRUST_PSYCHOLOGY_VERIFICATION_RULES,
  ...VISUAL_HIERARCHY_VERIFICATION_RULES,
  ...MOBILE_UX_VERIFICATION_RULES,
  ...JOURNEY_VERIFICATION_RULES,
  ...SEARCH_PERFORMANCE_VERIFICATION_RULES,
}

export function verificationRuleForCheckId(checkId: string): string | null {
  return ALL_VERIFICATION_RULES[checkId] ?? null
}

export function verifiableCheckIds(): string[] {
  return Object.keys(ALL_VERIFICATION_RULES)
}

export function allCheckIdsHaveVerificationRules(): boolean {
  return ALL_CHECK_IDS.every((id) => ALL_VERIFICATION_RULES[id] !== undefined)
}
