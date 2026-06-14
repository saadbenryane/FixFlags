import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'

const SCREENSHOT_BASE = '/samples'

export function getStaticSampleAudit(): LiveSampleAudit {
  return {
    id: 'static-sample',
    url: 'https://stripe.com',
    pageJob: 'Marketing page',
    pageType: 'Marketing page',
    score: 78,
    verdict:
      'Solid foundation with clear gaps in mobile layout and social sharing metadata. Three third-party scripts add measurable render delay.',
    completedAt: new Date('2026-06-10T14:30:00Z'),
    createdAt: new Date('2026-06-10T14:29:00Z'),
    pipelineVersion: PIPELINE_VERSION,
    reportCompleteness: 'FULL',
    startedAt: new Date('2026-06-10T14:29:00Z'),
    launchReadiness: {
      readiness: 'fix_first',
      checklist: [
        { id: 'screenshots', label: 'Evidence screenshots captured', passed: true },
        { id: 'areas', label: '7 areas graded', passed: true },
        { id: 'prompts', label: 'Fix prompts generated', passed: true },
        { id: 'recheck', label: 'Re-check ready', passed: false },
      ],
    },
    screenshots: [
      {
        device: 'DESKTOP',
        url: `${SCREENSHOT_BASE}/stripe-desktop.webp`,
        width: 1280,
        height: 900,
      },
      {
        device: 'MOBILE',
        url: `${SCREENSHOT_BASE}/stripe-mobile.webp`,
        width: 375,
        height: 812,
      },
    ],
    areas: [
      {
        id: 'area-performance',
        name: 'PERFORMANCE',
        grade: 'B',
        score: 82,
        status: 'GOOD',
        summary:
          'Load time is acceptable but 3 third-party scripts add ~80ms render delay. Lighthouse performance score in the B range.',
        areaPrompt:
          'Optimize third-party script loading. Defer or async-load the 3 non-critical scripts identified in the audit. Consider self-hosting analytics if possible.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-perf-1',
            severity: 'MEDIUM',
            problem: '3 third-party scripts add ~80ms render delay',
            evidence:
              'Scripts loaded from cdn.segment.com, js.stripe.com, and www.google-analytics.com. Combined blocking time ~80ms on desktop 1280x900 viewport.',
            whyItMatters:
              'Blocking scripts delay first paint and push interactive content later on marketing pages.',
            fix: 'Add async/defer to non-critical third-party scripts. Move analytics to load after onload.',
            agentPrompt:
              'Find script tags loading cdn.segment.com, www.google-analytics.com, and js.stripe.com. Add `async` or `defer` to Segment and Google Analytics. Keep Stripe.js synchronous. Verify in DevTools Network tab at 1280x900 desktop viewport.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Run Lighthouse. Main-thread blocking time should be under 30ms.',
            pageUrl: null,
          },
          {
            id: 'finding-perf-2',
            severity: 'LOW',
            problem: 'Unused CSS bundle adds 45KB to page weight',
            evidence:
              'CSS bundle includes styles for components not rendered on this marketing page. 45KB unused on desktop 1280x900.',
            whyItMatters:
              'Unused CSS increases parse time and network transfer.',
            fix: 'Implement per-page CSS bundles or purge unused styles.',
            agentPrompt:
              'Configure build tool for per-page CSS bundles. In Next.js, CSS modules or styled-components with tree-shaking. Verify by running DevTools coverage analysis on the marketing page at 1280x900 viewport.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Coverage tab in DevTools shows < 10% unused CSS.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-accessibility',
        name: 'ACCESSIBILITY',
        grade: 'A',
        score: 94,
        status: 'EXCELLENT',
        summary:
          'Strong contrast ratios, proper heading hierarchy, keyboard-navigable controls throughout.',
        areaPrompt:
          'No critical issues found. Maintain standards: include aria-labels on icon-only buttons, keep contrast ratios above 4.5:1.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-a11y-1',
            severity: 'INFO',
            problem: '2 icon buttons missing aria-labels',
            evidence:
              'Social media icon buttons in footer (1280x900 desktop) lack accessible labels.',
            whyItMatters:
              'Screen reader users cannot identify the action.',
            fix: 'Add aria-label attribute to each icon-only button.',
            agentPrompt:
              'In the footer component, find social media icon buttons and add `aria-label="Follow us on {Platform name}"`. Viewport: 1280x900 desktop.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'axe DevTools: no violations should appear.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-seo',
        name: 'SEO',
        grade: 'C',
        score: 65,
        status: 'NEEDS_WORK',
        summary:
          'og:image missing. Link previews show blank cards on social platforms. Heading hierarchy is good.',
        areaPrompt:
          'Add 1200x630 og:image tag to page head. Include og:title and og:description matching content. Verify with Twitter Card validator.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-seo-1',
            severity: 'HIGH',
            problem: 'Missing og:image — link previews show blank cards',
            evidence:
              'HTML head has no og:image meta tag. Desktop 1280x900: no preview card in social embeds.',
            whyItMatters:
              'Shared links show blank preview cards on Slack, Twitter, and WhatsApp without og:image.',
            fix: 'Add og:image meta tag pointing to a 1200x630 brand card.',
            agentPrompt:
              'Add openGraph metadata with images: [{ url: \'/og-image.png\', width: 1200, height: 630 }]. Generate a 1200x630 brand card with logo + page title. Verify with Twitter Card Validator.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Twitter Card Validator shows image + title + description.',
            pageUrl: null,
          },
          {
            id: 'finding-seo-2',
            severity: 'MEDIUM',
            problem: 'No meta description on the page',
            evidence:
              'HTML head lacks meta description tag. Google shows auto-generated snippets.',
            whyItMatters:
              'Missing meta description lets search engines generate snippets that may not match your value proposition.',
            fix: 'Add meta description (120-158 chars) with value proposition.',
            agentPrompt:
              'In metadata export, add `description: \'Accept payments, send payouts, and manage financial operations — Stripe powers online payment processing.\'` Keep under 160 characters.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Page source shows meta description tag with 120-158 chars.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-conversion',
        name: 'CONVERSION',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'CTA visible above fold on desktop. Value proposition clear but could target developers more directly.',
        areaPrompt:
          'Strengthen hero with outcome-oriented headline. Add social proof (customer count) near CTA.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-conv-1',
            severity: 'MEDIUM',
            problem: 'Hero headline describes product features, not user outcome',
            evidence:
              'Desktop 1280x900: "Financial infrastructure for the internet" — tells what Stripe is, not what user achieves.',
            whyItMatters:
              'Outcome-driven headlines help visitors understand what they gain, not just what the product is.',
            fix: 'Test headline: "Ship payment flows in days, not quarters."',
            agentPrompt:
              'In hero section, update H1 to: "Ship payment flows in days, not quarters." Keep it under 8 words at 1280px viewport. A/B test against current headline to measure conversion impact.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'New headline fits single line at 1280px viewport width.',
            pageUrl: null,
          },
          {
            id: 'finding-conv-2',
            severity: 'LOW',
            problem: 'No social proof visible near primary CTA',
            evidence:
              'Desktop 1280x900: CTA area lacks "trusted by" or customer count.',
            whyItMatters:
              'Social proof near the CTA reassures visitors before they commit to an action.',
            fix: 'Add trust line below CTA: "Trusted by millions of businesses worldwide."',
            agentPrompt:
              'Below primary CTA button, add `<p className="text-xs text-muted-foreground mt-2">Trusted by millions of businesses worldwide</p>`. Keep font small and muted — this is supplementary, not primary messaging.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Trust line renders directly below CTA button, no more than 4px gap.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-trust',
        name: 'TRUST',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'HTTPS enforced, privacy policy linked in footer. Security badges visible on checkout pages.',
        areaPrompt:
          'Add SOC 2 / PCI DSS compliance badges to homepage footer to reinforce trust earlier.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-trust-1',
            severity: 'LOW',
            problem: 'Security certifications not shown on marketing homepage',
            evidence:
              'Desktop 1280x900: No compliance badges in main content or footer.',
            whyItMatters:
              'Security badges on marketing pages reinforce trust before visitors submit forms or sign up.',
            fix: 'Add compliance badge row in footer or near the CTA.',
            agentPrompt:
              'In footer component, add a row: SOC 2, PCI DSS Level 1, GDPR badges. Use small monochrome text labels (12px, muted). Keep compact — max 24px height, placed above copyright line.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Badges render at bottom of page, above copyright.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-content',
        name: 'CONTENT',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'Copy is concise but uses financial jargon without explanation in several sections.',
        areaPrompt:
          'Replace financial jargon with plain language. Target Hemingway Grade 8 for marketing sections.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-content-1',
            severity: 'LOW',
            problem: 'Financial jargon without explanation in marketing copy',
            evidence:
              'Desktop 1280x900: "Authorization", "settlement", "dispute lifecycle" appear without definitions.',
            whyItMatters:
              'For startups evaluating Stripe, jargon creates confusion and increases bounce rate.',
            fix: 'Replace jargon with plain alternatives or add parenthetical explanations on first use.',
            agentPrompt:
              'In marketing copy, replace "authorization holds" with "payment holds", "settlement" with "funds transfer to your bank", "dispute lifecycle" with "how disputes work". Target Hemingway Grade 8 readability.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Hemingway App shows Grade 8 or lower for marketing sections.',
            pageUrl: null,
          },
        ],
      },
      {
        id: 'area-mobile',
        name: 'MOBILE',
        grade: 'C',
        score: 62,
        status: 'NEEDS_WORK',
        summary:
          'CTA below fold at 375px viewport. Tap targets meet minimum size. Font sizes readable.',
        areaPrompt:
          'Restructure mobile hero so primary CTA is in first viewport at 375px width. Current CTA starts at ~1,200px from top.',
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        findings: [
          {
            id: 'finding-mobile-1',
            severity: 'HIGH',
            problem: 'Primary CTA starts 1,200px below top on 375px viewport',
            evidence:
              'Mobile viewport 375x812: hero image pushes CTA to 1,200px scroll depth. Button hidden below fold.',
            whyItMatters:
              '60% of traffic is mobile. Hidden CTA causes visitors to leave.',
            fix: 'Reduce hero image height to 40vh on mobile. Stack CTA within first 700px of page height.',
            agentPrompt:
              'Add media query for max-width: 375px. Set hero image to 40vh max-height. Stack headline, subhead, and CTA button vertically so CTA appears within first 700px. Use CSS `order` or restructure DOM if needed. Target: CTA selector `.primary-cta` visible at <700px scroll.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Chrome DevTools at 375x812: CTA button visible without scrolling.',
            pageUrl: null,
          },
          {
            id: 'finding-mobile-2',
            severity: 'MEDIUM',
            problem: 'Navigation menu consumes 35% of viewport height on mobile',
            evidence:
              'Mobile 375x812: nav bar + announcement banner ~280px total before content starts.',
            whyItMatters:
              'Less content visible = lower engagement and scroll completion.',
            fix: 'Collapse announcement banner on mobile. Reduce nav padding. Use hamburger menu if nav links > 3.',
            agentPrompt:
              'At 375px breakpoint, hide secondary nav links behind hamburger toggle. Reduce announcement banner to 32px. Set nav wrapper max-height to 56px total. Selectors: `.announcement-banner`, `.primary-nav`, `.nav-links`.',
            cursorPrompt: null,
            claudePrompt: null,
            lovablePrompt: null,
            boltPrompt: null,
            verificationRule: 'Nav (incl announcement) is max 56px total at 375px viewport.',
            pageUrl: null,
          },
        ],
      },
    ],
  }
}
