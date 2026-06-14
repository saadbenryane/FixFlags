export type ExampleArea = {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  areaPrompt: string
  findings: Array<{
    id: string
    severity: string
    problem: string
    evidence: string
    whyItMatters: string
    fix: string
    agentPrompt: string | null
    verificationRule: string | null
  }>
}

export type ExampleAudit = {
  id: string
  url: string
  pageType: string
  score: number
  grade: string
  verdict: string
  tag: 'best-practices' | 'marketing' | 'content-heavy'
  areas: ExampleArea[]
}

export const EXAMPLE_AUDITS: ExampleAudit[] = [
  {
    id: 'example-webdev',
    url: 'https://web.dev',
    pageType: 'Documentation / Performance resource',
    score: 86,
    grade: 'B',
    tag: 'best-practices',
    verdict:
      'Well-optimized performance resource with strong scores across most areas. Minor gaps in mobile tap target spacing and content headings could be tighter.',
    areas: [
      {
        id: 'ex-webdev-perf',
        name: 'PERFORMANCE',
        grade: 'A',
        score: 92,
        status: 'EXCELLENT',
        summary:
          'Excellent Core Web Vitals. Fast Time to First Byte, optimized images, minimal JavaScript.',
        areaPrompt:
          'Maintain current performance budget. Review bundle weekly to catch regressions early.',
        findings: [
          {
            id: 'ex-webdev-perf-1',
            severity: 'LOW',
            problem: 'Service worker registration could be moved earlier',
            evidence:
              'Service worker registers at 2.8s after page start. Could register during idle time in initial load.',
            whyItMatters:
              'Earlier registration allows faster subsequent page loads and offline support activation.',
            fix: 'Move service worker registration to the document head with `{ type: "module" }`.',
            agentPrompt:
              'In the layout or entry script, move service worker registration to the `<head>` with `<script type="module">` and check for `navigator.serviceWorker` support. Register immediately without waiting for load event.',
            verificationRule: 'Service worker registers within 500ms of page start.',
          },
        ],
      },
      {
        id: 'ex-webdev-access',
        name: 'ACCESSIBILITY',
        grade: 'A',
        score: 95,
        status: 'EXCELLENT',
        summary:
          'Strong accessibility practices. Good color contrast, proper ARIA landmarks, keyboard navigable.',
        areaPrompt:
          'Continue current accessibility standards. Run automated checks on every PR.',
        findings: [
          {
            id: 'ex-webdev-access-1',
            severity: 'INFO',
            problem: 'Code snippet blocks lack accessible labels on syntax-highlighted elements',
            evidence:
              'Desktop 1280x900: Code samples use `<pre><code>` with syntax highlighting spans that lack accessible labels for line numbers.',
            whyItMatters:
              'Screen reader users may not distinguish code samples from surrounding text.',
            fix: 'Add `role="code"` and `aria-label="Code sample"` to code block containers.',
            agentPrompt:
              'In the code block wrapper component used on article pages, add `role="code"` and `aria-label="Code example: {language}"` attributes to the `<pre>` element.',
            verificationRule: 'VoiceOver correctly identifies code blocks as "Code example."',
          },
        ],
      },
      {
        id: 'ex-webdev-seo',
        name: 'SEO',
        grade: 'A',
        score: 90,
        status: 'EXCELLENT',
        summary:
          'All essential meta tags present. Good heading hierarchy. Open Graph tags properly implemented.',
        areaPrompt:
          'Consider adding structured data (Article schema) for rich search results.',
        findings: [
          {
            id: 'ex-webdev-seo-1',
            severity: 'LOW',
            problem: 'Article schema missing for tutorial pages',
            evidence:
              'Desktop 1280x900 viewport. Content pages lack JSON-LD structured data for article type.',
            whyItMatters:
              'Article schema enables rich search results with author image, publish date, and headline above the fold.',
            fix: 'Add JSON-LD Article schema to each content page with author, date published, and headline.',
            agentPrompt:
              'In the article layout component, add JSON-LD `<script type="application/ld+json">` with Article schema. Include `headline`, `datePublished`, `author`, `image` fields using page metadata.',
            verificationRule: 'Google Rich Results Test shows valid Article schema.',
          },
        ],
      },
      {
        id: 'ex-webdev-conv',
        name: 'CONVERSION',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'Clear primary call-to-action above the fold. Secondary actions less prominent.',
        areaPrompt:
          'Add a secondary CTA below key content sections to capture engaged readers.',
        findings: [
          {
            id: 'ex-webdev-conv-1',
            severity: 'LOW',
            problem: 'No CTA after long-form articles',
            evidence:
              'Desktop 1280x900: After scrolling through a 2000px+ article, there is no "next step" CTA near the content end.',
            whyItMatters:
              'Engaged readers who finish articles are high-intent — missing CTA is a missed conversion opportunity.',
            fix: 'Add a content-end CTA: "Try the audit →" or "Read the guide →".',
            agentPrompt:
              'In the article template, add a CTA section after the closing content, before the footer. Use existing button component: `<Button>Try the audit <ArrowRight /></Button>`. Keep it visually distinct from content.',
            verificationRule: 'CTA renders within 200px of the last content block.',
          },
        ],
      },
      {
        id: 'ex-webdev-trust',
        name: 'TRUST',
        grade: 'A',
        score: null,
        status: 'EXCELLENT',
        summary:
          'Google-hosted with valid HTTPS. Privacy policy clearly linked. No red flags.',
        areaPrompt:
          'Add a link to your status page or uptime monitor to reinforce reliability.',
        findings: [],
      },
      {
        id: 'ex-webdev-content',
        name: 'CONTENT',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'Well-written articles with clear section hierarchy. Some pages could benefit from more scannable subheadings.',
        areaPrompt:
          'Break up long sections with more descriptive subheadings. Add a table of contents for articles over 1500 words.',
        findings: [
          {
            id: 'ex-webdev-content-1',
            severity: 'LOW',
            problem: 'Long articles lack a table of contents for quick navigation',
            evidence:
              'Desktop 1280x900: Several articles over 2000 words have no in-page navigation beyond the browser scrollbar.',
            whyItMatters:
              'Table of contents increases time-on-page by 25% for content-heavy pages.',
            fix: 'Generate a sticky table of contents from the article heading hierarchy.',
            agentPrompt:
              'Create a sticky sidebar ToC component that parses h2/h3 elements from the article body. Render it at widths > 900px. Each item scrolls smoothly to its section. Use `IntersectionObserver` to highlight current section.',
            verificationRule: 'ToC renders on article pages > 1500 words at desktop width.',
          },
        ],
      },
      {
        id: 'ex-webdev-mobile',
        name: 'MOBILE',
        grade: 'B',
        score: 80,
        status: 'GOOD',
        summary:
          'Responsive design works well on mobile. Some tap targets close to minimum size.',
        areaPrompt:
          'Increase tap target minimum size to 44x44px on mobile. Review the nav button spacing at 375px.',
        findings: [
          {
            id: 'ex-webdev-mobile-1',
            severity: 'MEDIUM',
            problem: 'Mobile nav buttons have less than 44px tap target height',
            evidence:
              'Mobile viewport 375x812: Navigation toggle and menu items have tap targets measuring 36x40px.',
            whyItMatters:
              'Tap targets below 44px fail WCAG 2.5.5 and frustrate users on touch devices.',
            fix: 'Increase nav button tap targets to minimum 44x44px. Add padding or increase button area.',
            agentPrompt:
              'In the mobile nav stylesheet, set `.nav-toggle, .nav-item a { min-height: 44px; min-width: 44px; display: flex; align-items: center; }`. Apply at max-width: 768px breakpoint.',
            verificationRule: 'Chrome DevTools tap target highlight shows all buttons >= 44px.',
          },
        ],
      },
    ],
  },
  {
    id: 'example-vercel',
    url: 'https://vercel.com',
    pageType: 'Marketing / SaaS landing page',
    score: 72,
    grade: 'C',
    tag: 'marketing',
    verdict:
      'Strong brand presence but conversion path has friction. Mobile hero prioritizes visual over CTA visibility. Social sharing metadata needs improvement for organic reach.',
    areas: [
      {
        id: 'ex-vercel-perf',
        name: 'PERFORMANCE',
        grade: 'B',
        score: 78,
        status: 'GOOD',
        summary:
          'Good overall performance with CDN delivery. Heavy animations impact mobile performance scores.',
        areaPrompt:
          'Review animation performance on low-end mobile devices. Consider reducing motion for reduced-motion preferences.',
        findings: [
          {
            id: 'ex-vercel-perf-1',
            severity: 'MEDIUM',
            problem: 'Hero animation causes jank on mid-range mobile devices',
            evidence:
              'Mobile 375x812 viewport: page-level hero animations drop frames (15fps on Moto G4 simulation).',
            whyItMatters:
              'Janky animations hurt perceived performance and can increase bounce rate on mobile.',
            fix: 'Use `will-change: transform` on animated elements. Reduce animation complexity at mobile breakpoints.',
            agentPrompt:
              'In the hero section CSS, add `@media (prefers-reduced-motion: reduce) { .hero-animation { animation: none; } }`. For mobile breakpoints (< 768px), simplify the hero animation to a single fade-in instead of the multi-element parallax.',
            verificationRule: 'Frame rate stays above 30fps on Moto G4 DevTools emulation.',
          },
          {
            id: 'ex-vercel-perf-2',
            severity: 'LOW',
            problem: 'Two large WebP hero images not using responsive srcset',
            evidence:
              'Desktop 1280x900: hero image loaded at 1920x1080 native resolution, served at oversized dimensions.',
            whyItMatters:
              'Serving oversized images increases mobile data usage and load time.',
            fix: 'Implement `<picture>` with srcset for responsive image loading.',
            agentPrompt:
              'Replace `<img src="/hero.webp">` with `<picture><source srcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1200.webp 1200w" sizes="(max-width: 768px) 100vw, 1200px"><img src="/hero-1200.webp" alt=""></picture>`. Generate 400px, 800px, 1200px variants.',
            verificationRule: 'Mobile devices download 400w or 800w variant, not 1920w.',
          },
        ],
      },
      {
        id: 'ex-vercel-access',
        name: 'ACCESSIBILITY',
        grade: 'B',
        score: 76,
        status: 'GOOD',
        summary:
          'Accessible by default but interactive elements in the showcase section could use better keyboard support.',
        areaPrompt:
          'Add keyboard navigation to interactive demo carousels. Ensure focus order follows visual order.',
        findings: [
          {
            id: 'ex-vercel-access-1',
            severity: 'MEDIUM',
            problem: 'Framework showcase carousel lacks keyboard navigation',
            evidence:
              'Desktop 1280x900: The rotating carousel of framework cards cannot be navigated with arrow keys.',
            whyItMatters:
              'Keyboard-only users cannot access all content in the carousel.',
            fix: 'Add keyboard event listeners for left/right arrow navigation on the carousel.',
            agentPrompt:
              'In the showcase carousel component, add `onKeyDown` handler that captures ArrowLeft/ArrowRight and navigates slides. Add `tabIndex={0}` and `role="region"` to the carousel container. Add `aria-roledescription="carousel"` and `aria-label="Framework showcase".',
            verificationRule: 'Carousel navigable via Tab + Arrow keys.',
          },
        ],
      },
      {
        id: 'ex-vercel-seo',
        name: 'SEO',
        grade: 'C',
        score: 64,
        status: 'NEEDS_WORK',
        summary:
          'og:image is present but uses generic brand logo. Missing article-specific social previews for blog and changelog.',
        areaPrompt:
          'Generate per-page og:images for blog posts and changelog. Generic og:image produces identical previews for every page when shared.',
        findings: [
          {
            id: 'ex-vercel-seo-1',
            severity: 'HIGH',
            problem: 'Generic og:image shared across all pages',
            evidence:
              'Desktop 1280x900: Every page uses the same Vercel logo og:image. No page-specific preview card.',
            whyItMatters:
              'Generic og:image reduces click-through rate when shared on social media by up to 40% compared to a page-specific preview.',
            fix: 'Generate per-page og:images with page title and category overlay.',
            agentPrompt:
              'Create an `/api/og` edge function that generates 1200x630 PNGs with page title, category badge, and brand colors. Use Next.js `ImageResponse` or Satori. For blog posts, include author avatar and publish date. Apply via `metadata.openGraph.images` in each layout.',
            verificationRule: 'Each page type returns unique og:image with relevant content.',
          },
          {
            id: 'ex-vercel-seo-2',
            severity: 'MEDIUM',
            problem: 'Changelog pages lack structured data',
            evidence:
              'HTML head for changelog pages has no JSON-LD or release-related structured data.',
            whyItMatters:
              'Structured data helps Google show changelog entries in search results.',
            fix: 'Add `Release` structured data to changelog entries.',
            agentPrompt:
              'Add JSON-LD with `@type: "TechArticle"` or custom release schema to changelog page templates. Include `datePublished`, `version`, and `description`.',
            verificationRule: 'Rich Results Test validates the structured data.',
          },
        ],
      },
      {
        id: 'ex-vercel-conv',
        name: 'CONVERSION',
        grade: 'C',
        score: null,
        status: 'NEEDS_WORK',
        summary:
          'Hero section prioritizes visual impact over conversion clarity. CTA is below the fold on mobile. Value proposition is implied but not explicit.',
        areaPrompt:
          'Move primary CTA above the fold on both desktop and mobile. Strengthen the headline to explicitly state the developer outcome.',
        findings: [
          {
            id: 'ex-vercel-conv-1',
            severity: 'HIGH',
            problem: 'Primary CTA below the fold on mobile viewport',
            evidence:
              'Mobile 375x812: hero animation and tagline consume full viewport. "Deploy now" CTA starts at 950px from top.',
            whyItMatters:
              '60%+ of traffic is mobile. A CTA below the fold means visitors must scroll to take any action.',
            fix: 'Restructure mobile hero so CTA appears within the first 600px. Reduce hero animation height.',
            agentPrompt:
              'At mobile breakpoint (max-width: 768px), set hero section `min-height: 100dvh` but position CTA at bottom of the hero with `margin-top: auto`. Keep headline visible above fold. Reduce hero graphic height to 30vh. Selector: `.hero-section .cta-button`.',
            verificationRule: 'CTA button visible at < 700px scroll depth on 375x812 viewport.',
          },
          {
            id: 'ex-vercel-conv-2',
            severity: 'MEDIUM',
            problem: 'Headline is brand-forward, not outcome-forward',
            evidence:
              'Desktop 1280x900: "Develop. Preview. Ship." — describes actions, not the benefit. No audience or outcome named.',
            whyItMatters:
              'Outcome-driven headlines help visitors understand the benefit, not just the product category.',
            fix: 'Test headline variation: "Deploy your frontend in seconds, not hours."',
            agentPrompt:
              'In the hero component, update the H1 to an outcome-driven variant targeting developers: "Deploy your frontend in seconds, not hours." A/B test against current headline using the existing analytics system.',
            verificationRule: 'New headline tested with at least 1,000 sessions for significance.',
          },
        ],
      },
      {
        id: 'ex-vercel-trust',
        name: 'TRUST',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'HTTPS and security certificates in order. Privacy policy and terms accessible from footer.',
        areaPrompt:
          'Add customer logos or usage statistics near the CTA area to reinforce trust.',
        findings: [
          {
            id: 'ex-vercel-trust-1',
            severity: 'LOW',
            problem: 'Customer logos not visible above the fold',
            evidence:
              'Desktop 1280x900: Notable customer logos (Under Armour, The Washington Post) appear mid-page but not near the primary CTA.',
            whyItMatters:
              'Social proof near the CTA reassures B2B buyers before they take action.',
            fix: 'Add a compact "Trusted by" bar between the hero and the feature section.',
            agentPrompt:
              'Add a horizontal logo bar section between the hero and product features. Render customer logos as grayscale SVGs at 60px height. Include alt text for each. Keep it visually subtle — 0.5 opacity, centered, with a small "Trusted by" label above.',
            verificationRule: 'Logo bar renders below hero, above first feature section.',
          },
        ],
      },
      {
        id: 'ex-vercel-content',
        name: 'CONTENT',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'Concise, developer-appropriate copy. Tagline is memorable. Documentation is thorough.',
        areaPrompt:
          'Ensure the homepage benefit sections use language that resonates with non-technical decision-makers too.',
        findings: [
          {
            id: 'ex-vercel-content-1',
            severity: 'LOW',
            problem: 'Several benefits written in purely technical language',
            evidence:
              'Sections like "Automatic SSL" and "Edge Functions" use developer terminology without framing the business benefit.',
            whyItMatters:
              'Non-technical stakeholders need to understand the value. Purely technical language can slow enterprise buying decisions.',
            fix: 'Pair each feature with a one-line business benefit. Example: "Automatic SSL — ship securely without ops overhead."',
            agentPrompt:
              'For each feature heading in the benefits section, add a subtitle that frames the business outcome. Pattern: "{Feature name} — {business benefit in under 12 words}". Keep technical details in the body copy below.',
            verificationRule: 'Each feature section has a benefit subtitle visible at 1280px viewport.',
          },
        ],
      },
      {
        id: 'ex-vercel-mobile',
        name: 'MOBILE',
        grade: 'D',
        score: 58,
        status: 'CRITICAL',
        summary:
          'Mobile experience has significant friction: CTA hidden below hero animation, nav consumes too much vertical space, tap targets too small.',
        areaPrompt:
          'Immediate: move CTA above fold on 375px viewport. Short-term: redesign mobile nav to use hamburger menu, increase all tap targets to 44px minimum.',
        findings: [
          {
            id: 'ex-vercel-mobile-1',
            severity: 'HIGH',
            problem: 'Navigation bar consumes 22% of viewport height on mobile',
            evidence:
              'Mobile 375x812: top nav + announcement banner = 178px out of 812px total.',
            whyItMatters:
              'Wasted vertical space pushes content down, reducing engagement.',
            fix: 'Collapse nav to hamburger menu on mobile. Remove or slim down announcement banner.',
            agentPrompt:
              'At breakpoint max-width: 768px, replace desktop nav with hamburger toggle. Set nav container height to 56px. Slide-out menu overlays content instead of pushing it. Move announcement banner to a dismissible toast or remove entirely.',
            verificationRule: 'Nav height is 56px max at 375px viewport width.',
          },
          {
            id: 'ex-vercel-mobile-2',
            severity: 'MEDIUM',
            problem: 'Feature comparison cards have illegible 10px font on mobile',
            evidence:
              'Mobile 375x812: pricing and feature comparison table uses `font-size: 10px` for feature descriptions.',
            whyItMatters:
              '10px text at standard zoom is below WCAG AAA readability minimum. Users will pinch-zoom to read.',
            fix: 'Increase minimum font size to 14px on mobile. Stack table rows vertically instead of side-by-side.',
            agentPrompt:
              'Add media query for max-width: 768px. Set `font-size: 14px` on feature cell content. Re-layout the comparison from grid to single-column stack. Use `<dl>` pattern instead of `<table>` for better mobile reading.',
            verificationRule: 'All body text is >= 14px at 375px viewport width.',
          },
        ],
      },
    ],
  },
  {
    id: 'example-wikipedia',
    url: 'https://en.wikipedia.org',
    pageType: 'Content / Reference page',
    score: 68,
    grade: 'C',
    tag: 'content-heavy',
    verdict:
      'Exceptionally content-rich with deep information architecture. Social sharing metadata is minimal for such a widely-shared site. Mobile navigation handles depth well but text density is overwhelming at narrow widths.',
    areas: [
      {
        id: 'ex-wiki-perf',
        name: 'PERFORMANCE',
        grade: 'C',
        score: 62,
        status: 'NEEDS_WORK',
        summary:
          'Pages are lightweight text-first, but CSS/JS bundle sizes have grown significantly. Third-party analytics and fundraising banners add overhead.',
        areaPrompt:
          'Audit unused CSS rules in the Vector skin. Defer analytics and fundraising script loading. Consider splitting the main stylesheet into critical and deferred portions.',
        findings: [
          {
            id: 'ex-wiki-perf-1',
            severity: 'MEDIUM',
            problem: 'Main CSS bundle includes styles for rarely-used features',
            evidence:
              'Desktop 1280x900: Core stylesheet (160KB) contains styles for legacy skins, experimental features, and print layouts — ~40% unused on a standard article page.',
            whyItMatters:
              'Extra CSS increases parse time and blocks rendering, especially on slower connections.',
            fix: 'Split the stylesheet: critical rendering path CSS inlined, deferred CSS loaded asynchronously.',
            agentPrompt:
              'Extract critical above-the-fold CSS for the article view and inline it in the document `<head>`. Load remaining stylesheet with `media="print" onload="this.media=\'all\'"` pattern. Remove unused rules for legacy skins.',
            verificationRule: 'Lighthouse render-blocking resources audit passes. CSS size reduced by 40%.',
          },
          {
            id: 'ex-wiki-perf-2',
            severity: 'LOW',
            problem: 'Fundraising banner loads blocking JavaScript',
            evidence:
              'A 28KB banner JS bundle loads synchronously at the top of every page view, delaying content rendering.',
            whyItMatters:
              'Blocking JS delays first paint by 200-400ms on average connections.',
            fix: 'Load fundraising banner asynchronously after content is rendered.',
            agentPrompt:
              'Move fundraising banner script to bottom of `<body>` with `defer` attribute. Add CSS-only placeholder with fade-in animation for the banner content. Use `requestAnimationFrame` to initialize banner logic after first paint.',
            verificationRule: 'Lighthouse "Eliminate render-blocking resources" passes for the banner script.',
          },
        ],
      },
      {
        id: 'ex-wiki-access',
        name: 'ACCESSIBILITY',
        grade: 'A',
        score: 91,
        status: 'EXCELLENT',
        summary:
          'Industry-leading accessibility for a content site. Proper ARIA landmarks, skip-to-content, screen-reader-friendly table markup.',
        areaPrompt:
          'Maintain current standards. Consider adding dark mode support to reduce eye strain.',
        findings: [
          {
            id: 'ex-wiki-access-1',
            severity: 'INFO',
            problem: 'No dark mode despite high readership in low-light environments',
            evidence:
              'Desktop 1280x900: All pages render in light mode only. No preference query or toggle available.',
            whyItMatters:
              'Dark mode reduces eye strain for night-time reading and saves battery on OLED screens.',
            fix: 'Implement prefers-color-scheme dark mode variant. Add manual toggle as fallback.',
            agentPrompt:
              'Add `@media (prefers-color-scheme: dark)` overrides in the main stylesheet. Invert page background to `#1a1a1a`, text to `#e0e0e0`, links to `#8ab4f8`. Add a theme toggle in the sidebar that lets users override the OS preference.',
            verificationRule: 'Dark mode triggers correctly via OS setting and manual toggle.',
          },
        ],
      },
      {
        id: 'ex-wiki-seo',
        name: 'SEO',
        grade: 'C',
        score: 55,
        status: 'NEEDS_WORK',
        summary:
          'Wikipedia pages rank exceptionally well due to content authority, but Open Graph and Twitter Card metadata is minimal for such a widely-linked resource.',
        areaPrompt:
          'Add comprehensive Open Graph tags including og:image with article topic text. Twitter cards should show article excerpt.',
        findings: [
          {
            id: 'ex-wiki-seo-1',
            severity: 'HIGH',
            problem: 'No og:image tag — shared Wikipedia links show no preview image',
            evidence:
              'Desktop 1280x900: HTML head has no og:image meta. When shared on social media, links render as text-only cards.',
            whyItMatters:
              'Links without preview images receive 65% less engagement on social platforms.',
            fix: 'Generate og:image dynamically showing the article title, topic category (via tags), and Wikipedia wordmark.',
            agentPrompt:
              'Create an edge function at `/api/og` that accepts page title and first category tag. Returns 1200x630 PNG with Wikipedia wordmark, article title in readable font, and category badge. Apply via the page `metadata.openGraph` export in the skin templates.',
            verificationRule: 'Twitter Card validator shows preview with title and image.',
          },
          {
            id: 'ex-wiki-seo-2',
            severity: 'MEDIUM',
            problem: 'Twitter Card type defaults to "summary" instead of "summary_large_image"',
            evidence:
              'HTML head has `twitter:card` set to `summary` (small thumbnail) rather than `summary_large_image`.',
            whyItMatters:
              'Summary large image cards get 2x more engagement on Twitter than small image cards.',
            fix: 'Change `twitter:card` to `summary_large_image` and provide a high-resolution og:image.',
            agentPrompt:
              'In the HTML head template, change `<meta name="twitter:card" content="summary">` to `<meta name="twitter:card" content="summary_large_image">`. Ensure `og:image` is >= 1200x600px for large card rendering.',
            verificationRule: 'Twitter Card validator shows "Summary with large image" card type.',
          },
        ],
      },
      {
        id: 'ex-wiki-conv',
        name: 'CONVERSION',
        grade: 'D',
        score: null,
        status: 'CRITICAL',
        summary:
          'Wikipedia is donation-funded but the CTA experience has issues: fundraiser banners are disruptive, and there is no persistent low-friction donation option.',
        areaPrompt:
          'The fundraising banner should appear less intrusive. Add a small persistent "Support Wikipedia" link in the sidebar that stays across sessions.',
        findings: [
          {
            id: 'ex-wiki-conv-1',
            severity: 'HIGH',
            problem: 'Annual fundraising banner covers 40% of viewport on mobile',
            evidence:
              'Mobile 375x812: Fundraising banner overlays top 320px of screen with a "read more" expandable section. Takes significant visual space.',
            whyItMatters:
              'Overly intrusive donation prompts create negative sentiment and can reduce long-term user engagement.',
            fix: 'Reduce banner height to 80px on mobile. Use a discreet bottom-of-screen banner pattern.',
            agentPrompt:
              'At breakpoint max-width: 768px, change fundraise banner from top overlay to a fixed-position bottom bar (60px height). Text: "Help Wikipedia stay free." Button: "Donate" opens the donation page. On scroll-down, the bottom bar appears with a slide-up animation.',
            verificationRule: 'Banner height <= 80px on 375px viewport.',
          },
          {
            id: 'ex-wiki-conv-2',
            severity: 'MEDIUM',
            problem: 'No persistent donation prompt for recurring visitors',
            evidence:
              'Desktop 1280x900: The only donation CTA is the annual banner. There is no sidebar or footer link readers can use voluntarily.',
            whyItMatters:
              'A low-friction recurring donation option could increase funding from regular readers.',
            fix: 'Add a "Support Wikipedia" link in the left sidebar with a small heart icon.',
            agentPrompt:
              'In the Vector skin sidebar navigation, add a "Donate" link item placed in a visually distinct section. Use a small heart SVG as icon. Link: `https://donate.wikimedia.org`. The link should be visible at all times, not just during fundraising campaigns.',
            verificationRule: '"Donate" link visible in sidebar regardless of campaign period.',
          },
        ],
      },
      {
        id: 'ex-wiki-trust',
        name: 'TRUST',
        grade: 'A',
        score: null,
        status: 'EXCELLENT',
        summary:
          'Non-profit organization with transparent operations. Edits tracked with public history. Clear privacy and licensing policies.',
        areaPrompt:
          'Publicize recent editorial accuracy metrics or TrustScore-style indicators.',
        findings: [],
      },
      {
        id: 'ex-wiki-content',
        name: 'CONTENT',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary:
          'Exceptional depth and breadth. Consistent article structure with clear section headings, citations, and cross-references.',
        areaPrompt:
          'Add estimated reading time and summary callout boxes for long-form articles over 5000 words.',
        findings: [
          {
            id: 'ex-wiki-content-1',
            severity: 'LOW',
            problem: 'No estimated reading time for long-form articles',
            evidence:
              'Desktop 1280x900: Long articles (>5000 words) lack any indication of length or reading time.',
            whyItMatters:
              'Reading time estimates help users decide whether to read now or save for later.',
            fix: 'Add an estimated reading time badge below the article title, calculated from word count.',
            agentPrompt:
              'In the article header template, compute reading time from article text word count (assuming 200 words/min). Display as: "12 min read" badge next to the title. Use the existing badge component styling.',
            verificationRule: 'Reading time shows on articles over 1000 words.',
          },
        ],
      },
      {
        id: 'ex-wiki-mobile',
        name: 'MOBILE',
        grade: 'C',
        score: 68,
        status: 'NEEDS_WORK',
        summary:
          'Mobile interface is functional but text density is high at narrow widths. Table rendering is poor on small screens.',
        areaPrompt:
          'Tables should scroll horizontally or reflow on mobile. Increase readability by adding more line-height and vertical spacing.',
        findings: [
          {
            id: 'ex-wiki-mobile-1',
            severity: 'MEDIUM',
            problem: 'Data tables overflow viewport on mobile without horizontal scroll',
            evidence:
              'Mobile 375x812: Information tables (infoboxes, statistics) render beyond viewport width. Content is clipped or forces zoom-out.',
            whyItMatters:
              'Inaccessible table data means mobile readers miss key information and context.',
            fix: 'Add `overflow-x: auto` to table containers and reduce font size in tables at mobile widths.',
            agentPrompt:
              'In the Vector mobile stylesheet, wrap all content tables in a `div.table-wrapper` with `overflow-x: auto; -webkit-overflow-scrolling: touch`. Set table font size to 13px on mobile. Add `white-space: nowrap` only where needed.',
            verificationRule: 'All tables horizontally scrollable at 375px viewport width.',
          },
          {
            id: 'ex-wiki-mobile-2',
            severity: 'LOW',
            problem: 'Line height is too tight for comfortable article reading on mobile',
            evidence:
              'Mobile 375x812: Article body has `line-height: 1.4` which feels cramped on a phone screen for long-form reading.',
            whyItMatters:
              'Tight line-height on mobile reduces readability and increases eye strain for long sessions.',
            fix: 'Increase body text line-height to 1.6 on mobile breakpoints.',
            agentPrompt:
              'Add media query for max-width: 600px. Set `#mw-content-text p { line-height: 1.6; margin-bottom: 0.8em; }` to improve mobile readability. Also increase paragraph spacing slightly.',
            verificationRule: 'Body text line-height is 1.6 on screens < 600px wide.',
          },
        ],
      },
    ],
  },
]
