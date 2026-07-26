export type ExampleFlag = {
  id: string
  checkId?: string | null
  rubric: 'MESSAGE' | 'EXPERIENCE' | 'REACH'
  severity: 'CRITICAL' | 'IMPORTANT' | 'POLISH'
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt: string | null
  verificationRule: string | null
}

export type ExampleRubric = {
  id: string
  name: 'MESSAGE' | 'EXPERIENCE' | 'REACH'
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  rubricPrompt: string
}

export type ExampleAudit = {
  id: string
  url: string
  pageType: string
  score: number
  grade: string
  verdict: string
  tags: Array<'best-practices' | 'marketing' | 'content-heavy' | 'studio-ready'>
  rubrics: ExampleRubric[]
  flags: ExampleFlag[]
}

export const EXAMPLE_AUDITS: ExampleAudit[] = [
  {
    id: 'example-webdev',
    url: 'https://web.dev',
    pageType: 'Documentation / Performance resource',
    score: 86,
    grade: 'B',
    tags: ['best-practices'],
    verdict:
      'Well-optimized performance resource with strong scores across most rubrics. Minor gaps in mobile tap target spacing.',
    rubrics: [
      {
        id: 'ex-webdev-message',
        name: 'MESSAGE',
        grade: 'B',
        score: null,
        status: 'GOOD',
        summary: 'Clear primary call-to-action above the fold. Secondary actions less prominent.',
        rubricPrompt: 'Add a secondary CTA below key content sections to capture engaged readers.',
      },
      {
        id: 'ex-webdev-experience',
        name: 'EXPERIENCE',
        grade: 'A',
        score: 88,
        status: 'PASS',
        summary:
          'Excellent Core Web Vitals and accessibility. Some mobile tap targets close to minimum size.',
        rubricPrompt: 'Increase tap target minimum size to 44x44px on mobile.',
      },
      {
        id: 'ex-webdev-reach',
        name: 'REACH',
        grade: 'A',
        score: 90,
        status: 'PASS',
        summary: 'All essential meta tags present. Good heading hierarchy and Open Graph tags.',
        rubricPrompt: 'Consider adding structured data (Article schema) for rich search results.',
      },
    ],
    flags: [
      {
        id: 'ex-webdev-mobile-1',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Mobile nav buttons have less than 44px tap target height',
        evidence:
          'Mobile viewport 375x812: Navigation toggle and menu items have tap targets measuring 36x40px.',
        whyItMatters: 'Tap targets below 44px fail WCAG 2.5.5 and frustrate users on touch devices.',
        fix: 'Increase nav button tap targets to minimum 44x44px.',
        agentPrompt:
          'Add `min-height: 44px; min-width: 44px` to `.nav-toggle` and `.nav-item a` at max-width: 768px.',
        verificationRule: 'Chrome DevTools tap target highlight shows all buttons >= 44px.',
      },
      {
        id: 'ex-webdev-seo-1',
        rubric: 'REACH',
        severity: 'POLISH',
        problem: 'Article schema missing for tutorial pages',
        evidence:
          'Desktop 1280x900: Content pages lack JSON-LD structured data for article type.',
        whyItMatters:
          'Article schema enables rich search results with author image, publish date, and headline.',
        fix: 'Add JSON-LD Article schema to each content page.',
        agentPrompt:
          'Add JSON-LD `<script type="application/ld+json">` with Article schema to content pages.',
        verificationRule: 'Google Rich Results Test shows valid Article schema.',
      },
      {
        id: 'ex-webdev-conv-1',
        rubric: 'MESSAGE',
        severity: 'POLISH',
        problem: 'No CTA after long-form articles',
        evidence:
          'Desktop 1280x900: After scrolling through a 2000px+ article, there is no "next step" CTA.',
        whyItMatters:
          'Engaged readers who finish articles are high-intent; missing CTA is a missed conversion opportunity.',
        fix: 'Add a content-end CTA: "Try the check →".',
        agentPrompt:
          'Add a CTA section after `#article-body` content and before `footer`.',
        verificationRule: 'CTA renders within 200px of the last content block.',
      },
    ],
  },
  {
    id: 'example-vercel',
    url: 'https://vercel.com',
    pageType: 'Marketing / SaaS landing page',
    score: 72,
    grade: 'C',
    tags: ['marketing', 'studio-ready'],
    verdict:
      'Strong brand presence but conversion path has friction. Mobile hero prioritizes visual over CTA visibility.',
    rubrics: [
      {
        id: 'ex-vercel-message',
        name: 'MESSAGE',
        grade: 'C',
        score: null,
        status: 'NEEDS_ATTENTION',
        summary:
          'Hero section prioritizes visual impact over conversion clarity. Value proposition is implied but not explicit.',
        rubricPrompt:
          'Move primary CTA above the fold on both desktop and mobile. Strengthen the headline.',
      },
      {
        id: 'ex-vercel-experience',
        name: 'EXPERIENCE',
        grade: 'D',
        score: 58,
        status: 'BLOCKED',
        summary:
          'Mobile experience has significant friction: CTA hidden below hero animation, nav consumes too much vertical space.',
        rubricPrompt:
          'Immediate: move CTA above fold on 375px viewport. Redesign mobile nav to use hamburger menu.',
      },
      {
        id: 'ex-vercel-reach',
        name: 'REACH',
        grade: 'C',
        score: 64,
        status: 'NEEDS_ATTENTION',
        summary:
          'og:image is present but uses generic brand logo. Missing page-specific social previews.',
        rubricPrompt: 'Generate per-page og:images for blog posts and changelog.',
      },
    ],
    flags: [
      {
        id: 'ex-vercel-conv-1',
        rubric: 'MESSAGE',
        severity: 'CRITICAL',
        problem: 'Primary CTA below the fold on mobile viewport',
        evidence:
          'Mobile 375x812: hero animation and tagline consume full viewport. "Deploy now" CTA starts at 950px from top.',
        whyItMatters:
          'On a 375x812 viewport, the CTA starts at 950px from top. Visitors must scroll before they can take action.',
        fix: 'Restructure mobile hero so CTA appears within the first 600px.',
        agentPrompt:
          'At max-width: 768px, position `.cta-button` at the bottom with `margin-top: auto`. Reduce hero graphic height to 30vh.',
        verificationRule: 'CTA button visible at < 700px scroll depth on 375x812 viewport.',
      },
      {
        id: 'ex-vercel-seo-1',
        rubric: 'REACH',
        severity: 'CRITICAL',
        problem: 'Generic og:image shared across all pages',
        evidence:
          'Desktop 1280x900: Every page uses the same Vercel logo og:image. No page-specific preview card.',
        whyItMatters:
          'Generic og:image means every shared link shows the same preview regardless of content.',
        fix: 'Generate per-page og:images with page title and category overlay.',
        agentPrompt:
          'Create an `/api/og` edge route using `ImageResponse`. Generate 1200x630 PNGs with page title and brand colors.',
        verificationRule: 'Each page type returns a unique og:image with relevant content.',
      },
      {
        id: 'ex-vercel-mobile-1',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Navigation bar consumes 22% of viewport height on mobile',
        evidence: 'Mobile 375x812: top nav + announcement banner = 178px out of 812px total.',
        whyItMatters:
          'Nav + announcement banner consume 178px of 812px viewport height, so content starts lower on screen.',
        fix: 'Collapse nav to hamburger menu on mobile. Remove or slim down announcement banner.',
        agentPrompt:
          'At breakpoint max-width: 768px, replace desktop nav with hamburger toggle. Set nav container height to 56px.',
        verificationRule: 'Nav height is 56px max at 375px viewport width.',
      },
      {
        id: 'ex-vercel-conv-2',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        problem: 'Headline is brand-forward, not outcome-forward',
        evidence:
          'Desktop 1280x900: "Develop. Preview. Ship." describes actions, not the benefit.',
        whyItMatters:
          'Outcome-driven headlines help visitors understand the benefit, not just the product category.',
        fix: 'Test headline variation: "Deploy your frontend in seconds, not hours."',
        agentPrompt:
          'Update the H1 in `.hero-section` to an outcome-driven variant.',
        verificationRule: 'H1 renders on a single line at 1280px viewport width.',
      },
    ],
  },
  {
    id: 'example-wikipedia',
    url: 'https://en.wikipedia.org',
    pageType: 'Content / Reference page',
    score: 68,
    grade: 'C',
    tags: ['content-heavy'],
    verdict:
      'Exceptionally content-rich with deep information architecture. Social sharing metadata is minimal for such a widely-shared site.',
    rubrics: [
      {
        id: 'ex-wiki-message',
        name: 'MESSAGE',
        grade: 'D',
        score: null,
        status: 'BLOCKED',
        summary:
          'Wikipedia is donation-funded but the CTA experience has issues: fundraiser banners are disruptive.',
        rubricPrompt:
          'Reduce fundraising banner height on mobile. Add a persistent "Support Wikipedia" link in navigation.',
      },
      {
        id: 'ex-wiki-experience',
        name: 'EXPERIENCE',
        grade: 'C',
        score: 68,
        status: 'NEEDS_ATTENTION',
        summary:
          'Mobile interface is functional but text density is high at narrow widths. Table rendering is poor on small screens.',
        rubricPrompt:
          'Tables should scroll horizontally or reflow on mobile. Increase line-height and vertical spacing.',
      },
      {
        id: 'ex-wiki-reach',
        name: 'REACH',
        grade: 'C',
        score: 55,
        status: 'NEEDS_ATTENTION',
        summary:
          'Wikipedia pages rank well due to content authority, but Open Graph and Twitter Card metadata is minimal.',
        rubricPrompt:
          'Add complete Open Graph tags including og:image with article topic text.',
      },
    ],
    flags: [
      {
        id: 'ex-wiki-seo-1',
        rubric: 'REACH',
        severity: 'CRITICAL',
        problem: 'No og:image tag, shared Wikipedia links show no preview image',
        evidence:
          'Desktop 1280x900: HTML head has no og:image meta. When shared on social media, links render as text-only cards.',
        whyItMatters:
          'Shared links render as text-only cards on Slack, Twitter, and WhatsApp without og:image.',
        fix: 'Generate og:image dynamically showing the article title and Wikipedia wordmark.',
        agentPrompt:
          'Create an edge function at `/api/og` that accepts page title and first category tag. Returns 1200x630 PNG.',
        verificationRule: 'Twitter Card validator shows preview with title and image.',
      },
      {
        id: 'ex-wiki-conv-1',
        rubric: 'MESSAGE',
        severity: 'CRITICAL',
        problem: 'Annual fundraising banner covers 40% of viewport on mobile',
        evidence:
          'Mobile 375x812: Fundraising banner overlays top 320px of screen with expandable section.',
        whyItMatters:
          'Overly intrusive donation prompts create negative sentiment and can reduce long-term engagement.',
        fix: 'Reduce banner height to 80px on mobile. Use a discreet bottom-of-screen banner pattern.',
        agentPrompt:
          'At max-width: 768px, change fundraise banner from top overlay to a fixed-position bottom bar (60px height).',
        verificationRule: 'Banner height <= 80px on 375px viewport.',
      },
      {
        id: 'ex-wiki-mobile-1',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Data tables overflow viewport on mobile without horizontal scroll',
        evidence:
          'Mobile 375x812: Infoboxes and statistics tables render beyond viewport width.',
        whyItMatters: 'Inaccessible table data means mobile readers miss key information and context.',
        fix: 'Add `overflow-x: auto` to table containers and reduce font size in tables at mobile widths.',
        agentPrompt:
          'Wrap content tables in `div.table-wrapper { overflow-x: auto }`. Set table font-size to 13px at max-width: 375px.',
        verificationRule: 'All tables horizontally scrollable at 375px viewport width.',
      },
    ],
  },
]
