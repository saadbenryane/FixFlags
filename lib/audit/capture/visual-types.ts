/**
 * Visual type descriptors. Maps check IDs to their visual representation strategy.
 */
export type VisualType = 'static-overlay' | 'animated-gif' | 'side-by-side' | 'none'

export type OverlayTemplate =
  | 'gauge' | 'highlight' | 'fold-line' | 'thumb-zone'
  | 'font-map' | 'field-count' | 'link-map' | 'ghost-cta'
  | 'console-panel' | 'timer' | 'word-count' | 'size-labels'

export interface VisualDescriptor {
  type: VisualType
  overlay?: OverlayTemplate
  gifIntervalMs?: number
  gifMaxFrames?: number
  sideBySideMode?: 'desktop-mobile' | 'source-destination' | 'before-after'
  device?: 'desktop' | 'mobile' | 'both'
}

export const VISUAL_DESCRIPTORS: Record<string, VisualDescriptor> = {
  'lcp-critical': { type: 'animated-gif', gifIntervalMs: 600, gifMaxFrames: 8, device: 'desktop' },
  'lcp-poor': { type: 'animated-gif', gifIntervalMs: 500, gifMaxFrames: 6, device: 'desktop' },
  'cls-critical': { type: 'animated-gif', gifIntervalMs: 200, gifMaxFrames: 10, device: 'desktop' },
  'cls-poor': { type: 'animated-gif', gifIntervalMs: 250, gifMaxFrames: 8, device: 'desktop' },
  'render-blocking': { type: 'animated-gif', gifIntervalMs: 500, gifMaxFrames: 6, device: 'desktop' },
  'inp-critical': { type: 'animated-gif', gifIntervalMs: 100, gifMaxFrames: 8, device: 'desktop' },
  'inp-poor': { type: 'animated-gif', gifIntervalMs: 100, gifMaxFrames: 6, device: 'desktop' },
  'perf-score-critical': { type: 'static-overlay', overlay: 'gauge', device: 'desktop' },
  'perf-score-poor': { type: 'static-overlay', overlay: 'gauge', device: 'desktop' },
  'unoptimized-images': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'mobile-perf-critical': { type: 'animated-gif', gifIntervalMs: 600, gifMaxFrames: 8, device: 'mobile' },
  'mobile-perf-poor': { type: 'animated-gif', gifIntervalMs: 500, gifMaxFrames: 6, device: 'mobile' },
  'mobile-lcp-critical': { type: 'animated-gif', gifIntervalMs: 600, gifMaxFrames: 8, device: 'mobile' },
  'loading-indicator-stuck': { type: 'animated-gif', gifIntervalMs: 1000, gifMaxFrames: 4, device: 'mobile' },
  'loading-state-slow': { type: 'animated-gif', gifIntervalMs: 800, gifMaxFrames: 6, device: 'mobile' },
  'motion-ignores-reduced-preference': { type: 'side-by-side', sideBySideMode: 'before-after', device: 'mobile' },
  'cta-below-fold-mobile': { type: 'static-overlay', overlay: 'fold-line', device: 'mobile' },
  'mobile-input-zoom': { type: 'static-overlay', overlay: 'size-labels', device: 'mobile' },
  'mobile-cta-thumb-zone': { type: 'static-overlay', overlay: 'thumb-zone', device: 'mobile' },
  'mobile-cta-weak-label': { type: 'static-overlay', overlay: 'highlight', device: 'mobile' },
  'mobile-load-delay-content': { type: 'animated-gif', gifIntervalMs: 800, gifMaxFrames: 6, device: 'mobile' },
  'images-missing-alt': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'form-inputs-no-label': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'buttons-no-text': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'links-no-text': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'iframe-no-title': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'skip-link-missing': { type: 'static-overlay', overlay: 'ghost-cta', device: 'desktop' },
  'keyboard-nav-trap': { type: 'animated-gif', gifIntervalMs: 300, gifMaxFrames: 8, device: 'desktop' },
  'focus-visible-missing': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'form-missing-validation': { type: 'static-overlay', overlay: 'highlight', device: 'mobile' },
  'visual-radius-inconsistent': { type: 'static-overlay', overlay: 'size-labels', device: 'desktop' },
  'visual-typography-sprawl': { type: 'static-overlay', overlay: 'font-map', device: 'desktop' },
  'hierarchy-information-density': { type: 'static-overlay', overlay: 'word-count', device: 'desktop' },
  'friction-no-commitment-path': { type: 'static-overlay', overlay: 'ghost-cta', device: 'desktop' },
  'friction-form-too-many-fields': { type: 'static-overlay', overlay: 'field-count', device: 'desktop' },
  'trust-no-internal-links': { type: 'static-overlay', overlay: 'link-map', device: 'desktop' },
  'console-errors-critical': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'console-errors-some': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'competing-ctas': { type: 'static-overlay', overlay: 'highlight', device: 'mobile' },
  'flow-no-cta-found': { type: 'static-overlay', overlay: 'ghost-cta', device: 'desktop' },
  'flow-cta-unclickable': { type: 'animated-gif', gifIntervalMs: 300, gifMaxFrames: 4, device: 'desktop' },
  'flow-cta-404': { type: 'side-by-side', sideBySideMode: 'source-destination', device: 'desktop' },
  'flow-cta-dead-end': { type: 'side-by-side', sideBySideMode: 'source-destination', device: 'desktop' },
  'flow-cta-external-leave': { type: 'side-by-side', sideBySideMode: 'source-destination', device: 'desktop' },
  'flow-mobile-menu-broken': { type: 'animated-gif', gifIntervalMs: 300, gifMaxFrames: 4, device: 'mobile' },
  'scroll-ghost-sections': { type: 'animated-gif', gifIntervalMs: 500, gifMaxFrames: 6, device: 'desktop' },
  'flow-cta-blank-destination': { type: 'animated-gif', gifIntervalMs: 600, gifMaxFrames: 6, device: 'desktop' },
  'flow-cta-stuck-loading': { type: 'animated-gif', gifIntervalMs: 800, gifMaxFrames: 4, device: 'desktop' },
  'flow-destination-stuck-loading': { type: 'animated-gif', gifIntervalMs: 800, gifMaxFrames: 4, device: 'desktop' },
  'flow-destination-slow-load': { type: 'animated-gif', gifIntervalMs: 600, gifMaxFrames: 6, device: 'desktop' },
  'slow-3g-blank-screen': { type: 'animated-gif', gifIntervalMs: 2000, gifMaxFrames: 4, device: 'mobile' },
  'slow-3g-cta-delayed': { type: 'animated-gif', gifIntervalMs: 2000, gifMaxFrames: 4, device: 'mobile' },
  'checkout-link-dead': { type: 'side-by-side', sideBySideMode: 'source-destination', device: 'desktop' },
  'auth-page-broken': { type: 'side-by-side', sideBySideMode: 'source-destination', device: 'desktop' },
  'viewport-missing': { type: 'side-by-side', sideBySideMode: 'desktop-mobile', device: 'both' },
  // Text/meta checks: no visual needed
  'title-missing': { type: 'none' }, 'title-too-short': { type: 'none' }, 'title-too-long': { type: 'none' },
  'description-missing': { type: 'none' }, 'description-too-short': { type: 'none' }, 'description-too-long': { type: 'none' },
  'og-image-missing': { type: 'none' }, 'og-image-broken': { type: 'none' },
  'og-title-missing': { type: 'none' }, 'og-description-missing': { type: 'none' },
  'lang-missing': { type: 'none' }, 'canonical-missing': { type: 'none' },
  'robots-blocks-indexing': { type: 'none' }, 'favicon-missing': { type: 'none' },
  'no-structured-data': { type: 'none' }, 'sitemap-missing': { type: 'none' }, 'robots-txt-missing': { type: 'none' },
  'h1-missing': { type: 'none' }, 'h1-multiple': { type: 'none' },
  'messaging-weak-value-prop': { type: 'none' }, 'messaging-jargon-overload': { type: 'none' },
  'messaging-no-audience': { type: 'none' }, 'messaging-long-sentences': { type: 'none' },
  'messaging-headline-too-short': { type: 'none' },
  'friction-trial-commitment-unclear': { type: 'none' }, 'friction-no-risk-reversal': { type: 'none' },
  'friction-no-social-proof': { type: 'none' },
  'trust-no-authority-signals': { type: 'none' }, 'trust-testimonial-quality': { type: 'none' },
  'trust-unsupported-claims': { type: 'none' }, 'trust-no-direct-contact': { type: 'none' },
  'no-https': { type: 'none' }, 'no-privacy-policy': { type: 'none' }, 'no-contact-info': { type: 'none' },
  'cookie-consent-absent': { type: 'none' },
  'measurement-ga-gtm-posthog-missing': { type: 'none' },
  'security-csp-missing': { type: 'none' }, 'security-csp-unsafe-inline': { type: 'none' },
  'security-hsts-missing': { type: 'none' }, 'security-hsts-too-short': { type: 'none' },
  'security-frame-options-missing': { type: 'none' }, 'security-frame-options-too-permissive': { type: 'none' },
  'security-content-type-options-missing': { type: 'none' }, 'security-mixed-content': { type: 'none' },
  'unused-js-large': { type: 'none' }, 'unused-css-large': { type: 'none' },
  'tabindex-positive': { type: 'none' },
  'placeholder-copy-detected': { type: 'none' }, 'template-default-copy': { type: 'none' },
  'unreplaced-template-token': { type: 'none' }, 'cta-dead-link': { type: 'none' },
  'social-proof-unverifiable': { type: 'none' },
  'broken-internal-links': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'broken-page-anchors': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'flow-cta-destination-no-trust': { type: 'none' },
  'flow-destination-no-headline': { type: 'static-overlay', overlay: 'ghost-cta', device: 'desktop' },
  'flow-destination-no-cta': { type: 'static-overlay', overlay: 'ghost-cta', device: 'desktop' },
  'flow-cta-message-mismatch': { type: 'none' },
  'flow-destination-cta-overload': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'flow-destination-no-privacy': { type: 'none' },
  'flow-pricing-nav-broken': { type: 'animated-gif', gifIntervalMs: 300, gifMaxFrames: 4, device: 'desktop' },
  'flow-form-no-validation': { type: 'animated-gif', gifIntervalMs: 500, gifMaxFrames: 4, device: 'desktop' },
  'flow-form-slow-feedback': { type: 'animated-gif', gifIntervalMs: 300, gifMaxFrames: 6, device: 'desktop' },
  'overlay-blocks-nav': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'overlay-blocks-cta': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'overlay-blocks-form': { type: 'static-overlay', overlay: 'highlight', device: 'desktop' },
  'api-engagement-unauthorized': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'api-engagement-server-error': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'form-submit-api-unauthorized': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'form-submit-api-server-error': { type: 'static-overlay', overlay: 'console-panel', device: 'desktop' },
  'form-submit-silent-failure': { type: 'static-overlay', overlay: 'field-count', device: 'desktop' },
}

export function getVisualDescriptor(checkId: string): VisualDescriptor {
  return VISUAL_DESCRIPTORS[checkId] ?? { type: 'none' }
}

export function getGifCaptureCheckIds(device: 'desktop' | 'mobile'): string[] {
  return Object.entries(VISUAL_DESCRIPTORS)
    .filter(([, d]) => d.type === 'animated-gif' && (d.device === device || d.device === 'both' || !d.device))
    .map(([id]) => id)
}

export function getOverlayCheckIds(): string[] {
  return Object.entries(VISUAL_DESCRIPTORS)
    .filter(([, d]) => d.type === 'static-overlay')
    .map(([id]) => id)
}
