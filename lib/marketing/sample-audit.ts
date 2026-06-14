import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '@/lib/audit/viewports'

export const SAMPLE_STRIPE_AUDIT = {
  url: 'https://stripe.com',
  score: 91,
  pageType: 'marketing',
  pageJob: 'Convert developers and businesses into Stripe payment platform customers',
  verdict:
    'Strong across all seven areas. A useful benchmark for developer-focused SaaS — minor performance and navigation polish opportunities remain.',
  screenshots: [
    {
      device: 'DESKTOP' as const,
      url: '/samples/stripe-desktop.webp',
      width: DESKTOP_VIEWPORT.width,
      height: DESKTOP_VIEWPORT.height,
    },
    {
      device: 'MOBILE' as const,
      url: '/samples/stripe-mobile.webp',
      width: MOBILE_VIEWPORT.width,
      height: MOBILE_VIEWPORT.height,
    },
  ],
  areas: [
    {
      id: 'sample-stripe-performance',
      name: 'PERFORMANCE',
      grade: 'A',
      score: 94,
      status: 'PASS',
      summary: 'Fast load times with minimal render-blocking resources. Third-party scripts add a small delay.',
      areaPrompt:
        'Audit stripe.com performance. Focus on third-party script loading order and defer non-critical analytics until after LCP.',
      cursorPrompt:
        'Review stripe.com homepage performance. Defer or async-load non-critical third-party scripts (analytics, A/B testing) until after the hero content paints. Target: reduce render delay by ~80ms.',
      findings: [
        {
          id: 'sample-stripe-perf-1',
          severity: 'LOW',
          problem: '3 third-party scripts add ~80ms render delay',
          evidence:
            'Lighthouse trace shows analytics.js, segment.io, and Hotjar loading synchronously in <head> before hero paint.',
          whyItMatters:
            'Each millisecond of render delay increases bounce rate on high-intent landing pages. Developer audiences are especially sensitive to perceived speed.',
          fix: 'Add defer or async attributes to non-critical third-party scripts, or load them after window.load via a small loader snippet.',
        },
        {
          id: 'sample-stripe-perf-2',
          severity: 'INFO',
          problem: 'Preconnect hints missing for CDN origins',
          evidence: 'No rel=preconnect for cdn.stripe.com in document head.',
          whyItMatters: 'DNS + TLS setup for CDN assets can add latency on first paint.',
          fix: 'Add preconnect links for primary CDN and font origins used above the fold.',
        },
        {
          id: 'sample-stripe-perf-3',
          severity: 'INFO',
          problem: 'Hero image lacks explicit dimensions',
          evidence: 'Largest hero visual has no width/height attributes, contributing to minor CLS risk.',
          whyItMatters: 'Layout shift during load hurts perceived quality on marketing pages.',
          fix: 'Set width and height on hero imagery or reserve aspect-ratio in CSS.',
        },
        {
          id: 'sample-stripe-perf-4',
          severity: 'LOW',
          problem: 'Unused CSS bundle on homepage',
          evidence: 'Coverage report shows ~12% of CSS rules unused on initial navigation.',
          whyItMatters: 'Extra CSS bytes slow first load on mobile networks.',
          fix: 'Split critical CSS for above-the-fold content and defer non-critical styles.',
        },
      ],
    },
    {
      id: 'sample-stripe-accessibility',
      name: 'ACCESSIBILITY',
      grade: 'A',
      score: 97,
      status: 'PASS',
      summary: 'Excellent semantic structure, contrast ratios, and keyboard navigation throughout.',
      areaPrompt:
        'Audit stripe.com accessibility. Verify focus order in the mega-menu and ensure all interactive elements have accessible names.',
      findings: [],
    },
    {
      id: 'sample-stripe-seo',
      name: 'SEO',
      grade: 'A',
      score: 98,
      status: 'PASS',
      summary: 'Complete meta tags, structured data, and clean heading hierarchy. Strong organic foundation.',
      areaPrompt:
        'Audit stripe.com SEO. Confirm Organization schema is valid and canonical tags are consistent across locale variants.',
      findings: [],
    },
    {
      id: 'sample-stripe-conversion',
      name: 'CONVERSION',
      grade: 'A',
      score: null,
      status: 'PASS',
      summary: 'Clear primary CTA above the fold with strong value proposition and social proof placement.',
      areaPrompt:
        'Audit stripe.com conversion flow. Evaluate CTA hierarchy on the homepage and whether secondary CTAs compete with the primary signup path.',
      findings: [],
    },
    {
      id: 'sample-stripe-trust',
      name: 'TRUST',
      grade: 'A',
      score: null,
      status: 'PASS',
      summary: 'Enterprise logos, security badges, and compliance messaging are prominent and credible.',
      areaPrompt:
        'Audit stripe.com trust signals. Verify security/compliance badges link to current documentation and are visible on mobile.',
      findings: [],
    },
    {
      id: 'sample-stripe-content',
      name: 'CONTENT',
      grade: 'A',
      score: null,
      status: 'PASS',
      summary: 'Clear messaging for developer and business audiences. Navigation could be simplified for first-time visitors.',
      areaPrompt:
        'Audit stripe.com content and navigation. Simplify the top-level nav for new visitors while preserving power-user paths.',
      findings: [
        {
          id: 'sample-stripe-content-1',
          severity: 'INFO',
          problem: 'Navigation has 22 items. Could be simplified for new visitors.',
          evidence:
            'Main nav contains 22 top-level and dropdown items across Products, Solutions, Developers, Resources, and Pricing.',
          whyItMatters:
            'Choice overload slows decision-making for first-time visitors who haven\'t yet formed a mental model of Stripe\'s product suite.',
          fix: 'Group related items under fewer top-level categories, or add a "Getting started" path that surfaces the 3–4 most common entry points.',
        },
      ],
    },
    {
      id: 'sample-stripe-mobile',
      name: 'MOBILE',
      grade: 'A',
      score: 92,
      status: 'PASS',
      summary: 'Responsive layout with readable typography. Hero animation is slightly heavy on low-end devices.',
      areaPrompt:
        'Audit stripe.com mobile experience. Optimize hero animation weight and verify primary CTA is visible without scrolling on 375px viewport.',
      findings: [
        {
          id: 'sample-stripe-mobile-1',
          severity: 'LOW',
          problem: 'Hero gradient animation causes minor jank on low-end mobile devices',
          evidence:
            'Performance panel on Moto G4 emulation shows 3 dropped frames during hero gradient CSS animation on initial load.',
          whyItMatters:
            'Janky first impressions on mobile reduce trust for a payments brand where reliability is the core promise.',
          fix: 'Use prefers-reduced-motion to disable the animation, or replace CSS gradient animation with a static gradient on viewports under 768px.',
        },
      ],
    },
  ],
}
