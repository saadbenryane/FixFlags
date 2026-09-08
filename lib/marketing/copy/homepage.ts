export const HERO = {
  badge: 'Website intelligence',
  headline: 'Find what is getting in the way of your next customer.',
  /** Full headline without the period; period is rendered in brand orange. */
  headlineDisplay: 'Find what is getting in the way of your next customer',
  headlineAccentPeriod: true,
  subhead:
    'Enter your website. FixFlags finds problems in the pages and paths that drive leads, signups, and sales, then shows you what to fix first.',
  primaryCta: 'Review my site',
  compactPrimaryCta: 'Review',
  primaryHref: '/#audit',
  trySampleCta: 'See how it works',
  secondaryHref: '/how-it-works',
  urlPlaceholder: 'yoursite.com',
  /** Product-true trust line only. No invented member counts or stock avatars. */
  trustLine: 'Start with a URL. No installation required.',
  scrollHint: "Scroll to discover",
} as const;

export const DIFFERENTIATION = {
  label: "Why FixFlags",
  headline: "Store up is not the same as can buy",
  subhead: "Uptime checks miss a dead add to cart. FixFlags walks the path a customer uses.",
  lighthouseLinkText: "Compare a live walk with an HTTP uptime check",
  is: [
    "A mobile walk of the path to checkout",
    "Video of what FixFlags saw, not a score",
    "Alerts only when the path is confirmed broken",
  ],
  isNot: [
    "Not a Lighthouse wrapper",
    "Not session replay of real shoppers",
    "Not an ads attribution suite",
  ],
  bullets: [
    "Walks product, cart, and checkout on a phone-sized browser",
    "Confirms RED twice before it emails you",
    "Keeps Improve off the alarm",
  ],
  rows: [
    {
      feature: "Shows why each Flag matters, with evidence",
      lighthouse: "Partial",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "AI reads screenshots for UX gaps",
      lighthouse: "No",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Identifies missing og:image",
      lighthouse: "Partial",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Checks mobile CTA placement",
      lighthouse: "No",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Writes fix prompts your agent runs after signup",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
    {
      feature: "Update review after fixes",
      lighthouse: "Manual",
      manual: "Manual",
      fixflags: "Built-in",
    },
    {
      feature: "Before/after comparison",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
    {
      feature: "Public report link",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
    {
      feature: "Copyable fix prompts for builders",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
  ],
  comparisonRows: [
    {
      feature: "Walks add to cart on a real mobile browser",
      lighthouse: "No",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Video of the failed walk",
      lighthouse: "No",
      manual: "Sometimes",
      fixflags: "Yes",
    },
    {
      feature: "Retries before it calls the path broken",
      lighthouse: "No",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Installs from the Shopify App Store",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
    {
      feature: "Stops before payment",
      lighthouse: "n/a",
      manual: "Depends",
      fixflags: "Yes",
    },
  ],
} as const;

export const FINAL_CTA = {
  headlineDisplay: 'Enter your site. See what matters first',
  headlineAccentPeriod: true,
  body: 'Start with a free website analysis. Save the Site when you want FixFlags to keep watching.',
} as const;

export const BUILDER_WORKFLOW_SECTION = {
  headline: "Watch the walk. Fix the store. Recheck",
  body: "Open the verification, fix the theme or app that blocked checkout, then walk the path again.",
  intro: "The loop stays focused:",
  closing: "A recovery notice is sent when the path can take orders again.",
  cta: "See how it works",
  workflow: `1. Install FixFlags on Shopify.
2. Watch the first walk to checkout.
3. If the path is down, fix the theme or app.
4. Recheck.
5. Keep monitoring on.`,
} as const;

/** @deprecated Internal compatibility alias; the section is URL-first and contains no MCP offer. */
export const MCP_SECTION = BUILDER_WORKFLOW_SECTION;

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: 'How it works',
    headline: 'See the problem. Fix it. Know it works.',
    headlineAccentPeriod: false,
    subhead:
      'FixFlags does the checking, keeps the evidence together, and returns to the live website after the change.',
    primaryCta: 'Check my website',
    primaryHref: '/#audit',
    secondaryCta: 'See a sample review',
    secondaryHref: '/samples',
    annotations: [
      {
        id: 'website-live',
        title: 'Website live',
        percent: "",
        body: 'Traffic can still arrive.',
        tone: "muted" as const,
      },
      {
        id: 'friction',
        title: 'Friction',
        percent: "",
        body: 'The next customer can still get stuck.',
        tone: "muted" as const,
      },
      {
        id: "fixflags",
        title: "FixFlags",
        percent: "",
        body: 'Flags, evidence, and verification.',
        tone: "brand" as const,
      },
    ],
    features: [
      {
        title: 'A website can look finished',
        body: 'The page loads and traffic can still arrive.',
        icon: "sparkles" as const,
      },
      {
        title: 'The important path can still fail',
        body: 'A form stalls, a CTA goes nowhere, a page gets slow, or tracking disappears.',
        icon: "warning" as const,
      },
      {
        title: 'FixFlags finds what matters',
        body: 'It inspects the site and independently verifies important paths.',
        icon: "shield" as const,
      },
      {
        title: 'You get the evidence',
        body: 'See what happened, where it happened, and why it deserves attention.',
        icon: "check" as const,
      },
      {
        title: 'Then verify the change',
        body: 'FixFlags returns to the live Site and keeps watching for meaningful regressions.',
        icon: "rocket" as const,
      },
    ],
  },
  reportPreview: {
    label: 'What you get',
    title: 'A Flag with evidence, not a score dump.',
    body: 'Each Flag says what happened, where it happened, why it matters, and what should happen next.',
    rubricLine:
      'Pages, funnels, source context, verification, and history make the same Site smarter over time.',
    sampleLabel: 'Sample Site',
    sampleCta: 'Explore a sample review',
    sampleHref: '/samples',
    flags: [
      {
        rubric: "Protect",
        severity: "Can't buy",
        finding: "Add to cart did not put the product in the cart.",
        evidence:
          "Two independent mobile walks. The cart stayed empty after the click.",
      },
      {
        rubric: "Prove",
        severity: "Video",
        finding: "Watch the walk FixFlags ran.",
        evidence: "Product, add to cart, failed cart. We stopped there.",
      },
      {
        rubric: "Understand",
        severity: "Step",
        finding: "The named step is add to cart.",
        evidence: "Store-wide conversion numbers wait for approved reports access.",
      },
    ],
  },
  reviewTypes: {
    label: 'One Site',
    title: 'Start with a URL. Keep the Site getting smarter.',
    body: 'FixFlags starts with public website evidence and adds verification or connected context only when it improves an answer.',
    completeReview: {
      title: 'What every first review includes',
      body: 'Important pages, safe paths, Flags, and evidence you can inspect immediately.',
    },
    verification: {
      title: 'How you verify a fix',
      body: 'Publish the change, then let FixFlags independently revisit the live Site.',
    },
    docsCta: 'Read the website review guide',
    docsHref: "/docs/reports",
    analogyLine:
      'A Site keeps its Flags, verification, context, and history together over time.',
  },
  loop: {
    label: 'How FixFlags works',
    title: 'See the problem. Fix it. Know it works.',
    steps: [
      {
        title: 'Check',
        body: 'FixFlags opens pages, follows important actions, and records what actually happens.',
      },
      {
        title: 'Flag',
        body: 'One important action fails. You see what happened, where, and why it matters.',
      },
      {
        title: 'Fix',
        body: 'The next step comes with context. Read it, share it, or give the evidence to the AI tool you already use.',
      },
      {
        title: 'Verify',
        body: 'FixFlags repeats the same action on the live website and confirms the success state appears.',
      },
    ],
  },
  shopify: {
    label: 'Shopify connection',
    title: 'Add commerce context when your Site needs it.',
    body: 'Shopify adds product structure and purchase-path checks to the same FixFlags Site.',
    cta: 'Connect Shopify',
    href: '/install',
  },
  mcp: {
    label: 'Work with your agent',
    title: 'Give your AI the evidence. FixFlags verifies the result.',
    body: 'Use a focused Flag in the coding agent you already use, then let FixFlags independently revisit the live Site.',
    setupCta: 'Read the website review guide',
    setupHref: "/docs/reports",
    plansCta: "See plans",
    plansHref: "/pricing",
    transcript: `FixFlags: "The primary action is hidden below the first mobile viewport."
You: use the evidence in your coding agent
You: publish the change
FixFlags: "The original problem is no longer observed in this update review."`,
  },
  finalCta: {
    headline: 'Enter your site. See what matters first.',
    body: 'Start with a free website analysis. Save the Site when you want FixFlags to keep watching.',
    primaryCta: 'Review my site',
    primaryHref: '/#audit',
    secondaryCta: "See how it works",
    secondaryHref: '/how-it-works',
    tryLabel: 'Try it on a live website',
  },
} as const;

export const LANDING_PAGE = {
  logoCloud: {
    label: "Works where you build",
    disclaimer: "",
  },
  checkDimensions: {
    label: "What FixFlags reviews",
    headlineDisplay: "See your product through your users’ eyes",
    headlineAccentPeriod: true,
    headline: "See your product through your users’ eyes.",
    subhead:
      "We check whether people understand what you offer, can use the product without getting stuck, and can find or share it.",
    allChecksTab: "All checks",
    topIssuesTitle: "Top Flags",
    viewAllIssues: "View all Flags",
    viewAllIssuesHref: "/issues",
    cards: [
      {
        id: "message",
        title: "Message",
        label: "Message",
        panelTitle: "Communicate what matters.",
        question: "Do people understand what this is and why it matters?",
        panelBody:
          "We look at your headline, page structure, and calls to action to see whether the value is clear.",
        icon: "message",
        tint: "brand",
        checks: [
          "Value proposition and audience",
          "Content hierarchy",
          "CTA specificity",
          "Readability and tone",
        ] as const,
        topIssues: [
          {
            title: "Hero value is unclear",
            severity: "High",
            body: "Primary headline does not state the outcome.",
            category: "message",
            categoryHref: "/issues",
          },
          {
            title: "CTA stays vague",
            severity: "Medium",
            body: "Button copy does not name the next step.",
            category: "message",
            categoryHref: "/issues",
          },
          {
            title: "Audience never named",
            severity: "Medium",
            body: "Who this is for stays implicit above the fold.",
            category: "message",
            categoryHref: "/issues",
          },
          {
            title: "Outcome buried below the fold",
            severity: "Medium",
            body: "The result users care about appears too late.",
            category: "message",
            categoryHref: "/issues",
          },
        ] as const,
      },
      {
        id: "experience",
        title: "Experience",
        label: "Experience",
        panelTitle: "Make every next step obvious.",
        question: "Can people do what they came to do?",
        panelBody:
          "We test the main path on desktop and mobile to find confusing, broken, or hard-to-use steps.",
        icon: "experience",
        tint: "success",
        checks: [
          "Mobile layout and tap targets",
          "Primary flow completion",
          "Accessibility blockers",
          "Errors, trust, and feedback",
        ] as const,
        topIssues: [
          {
            title: "Hidden mobile CTA",
            severity: "High",
            body: "Primary call-to-action is below the fold on mobile.",
            category: "experience",
            categoryHref: "/issues",
          },
          {
            title: "Low contrast text",
            severity: "Medium",
            body: "Text contrast ratio fails WCAG AA standards.",
            category: "experience",
            categoryHref: "/issues",
          },
          {
            title: "Tap targets too small",
            severity: "Medium",
            body: "Primary controls sit under the 44px hit area.",
            category: "experience",
            categoryHref: "/issues",
          },
          {
            title: "Form recovery is clear",
            severity: "Good",
            body: "Inline validation explains how to recover.",
            category: "experience",
            categoryHref: "/issues",
          },
        ] as const,
      },
      {
        id: "reach",
        title: "Reach",
        label: "Reach",
        panelTitle: "Show up clearly when people find and share you.",
        question: "Can people find it and share it clearly?",
        panelBody:
          "We check search details and link previews so the product appears clearly beyond your site.",
        icon: "reach",
        tint: "info",
        checks: [
          "Titles and descriptions",
          "Social preview coverage",
          "Indexability and canonicals",
          "Structured discovery signals",
        ] as const,
        topIssues: [
          {
            title: "Missing og:image",
            severity: "High",
            body: "Link previews show a blank card on Slack and X.",
            category: "reach",
            categoryHref: "/issues",
          },
          {
            title: "Meta description missing",
            severity: "Medium",
            body: "Pages are missing meta descriptions.",
            category: "reach",
            categoryHref: "/issues",
          },
          {
            title: "Canonical missing",
            severity: "Medium",
            body: "Duplicate URLs are not consolidated.",
            category: "reach",
            categoryHref: "/issues",
          },
          {
            title: "Favicon present",
            severity: "Good",
            body: "Browser tabs show your mark correctly.",
            category: "reach",
            categoryHref: "/issues",
          },
        ] as const,
      },
    ] as const,
    allChecks: {
      id: "all",
      title: "All checks",
      label: "Full report",
      panelTitle: "See the full fix list.",
      question: "What needs fixing before the next release?",
      panelBody:
        "One report connects what people understand, what they can complete, and whether they can find and share the product.",
      icon: "all",
      checks: [
        "Message: understand the value",
        "Experience: complete the next step",
        "Reach: find and share the product",
        "One ranked plan across all three",
      ] as const,
      topIssues: [
        {
          title: "Hidden mobile CTA",
          severity: "High",
          body: "Primary action sits below the first mobile screen.",
          category: "experience",
          categoryHref: "/issues",
        },
        {
          title: "Hero value is unclear",
          severity: "High",
          body: "The headline does not name the user outcome.",
          category: "message",
          categoryHref: "/issues",
        },
        {
          title: "Social preview image missing",
          severity: "Medium",
          body: "Shared links appear without a useful preview.",
          category: "reach",
          categoryHref: "/issues",
        },
        {
          title: "HTTPS enabled",
          severity: "Good",
          body: "The product is served over a secure connection.",
          category: "reach",
          categoryHref: "/issues",
        },
      ] as const,
    },
    values: [
      {
        id: "aligned",
        title: "Human-aligned AI",
        body: "Judgment grounded in real product standards.",
        icon: "shield" as const,
      },
      {
        id: "evidence",
        title: "Evidence, not opinion",
        body: "Every Flag points to the screen and behavior behind it.",
        icon: "target" as const,
      },
      {
        id: "fixes",
        title: "Fixes made to ship",
        body: "Clear prompts you can take straight to your AI editor.",
        icon: "zap" as const,
      },
      {
        id: "recheck",
        title: "Review the update",
        body: "A fresh review shows what changed and what still needs attention.",
        icon: "refresh" as const,
      },
    ] as const,
  },
  howItWorks: {
    label: 'How it works',
    headlineDisplay: 'See the problem. Fix it. Know it works',
    headlineAccentPeriod: true,
    headline: 'See the problem. Fix it. Know it works.',
    subhead:
      'FixFlags does the checking, keeps the evidence together, and returns to the live website after the change.',
    sampleLink: 'See a sample review',
    previewLabel: 'A Flag with evidence',
    previewTitle: 'No confirmation after contact',
    previewBody: 'The form sends. Visitors never see that it worked.',
    steps: [
      {
        step: 1,
        title: 'Check',
        body: 'FixFlags opens pages, follows important actions, and records what actually happens.',
      },
      {
        step: 2,
        title: 'Flag',
        body: 'One important action fails. You see what happened, where, and why it matters.',
      },
      {
        step: 3,
        title: 'Fix',
        body: 'The next step comes with context. Read it, share it, or give the evidence to the AI tool you already use.',
      },
      {
        step: 4,
        title: 'Verify',
        body: 'FixFlags repeats the same action on the live website and confirms the success state appears.',
      },
    ] as const,
  },
  proof: {
    label: 'Find what matters',
    headlineDisplay: 'One website. Evidence that gets smarter over time',
    headlineAccentPeriod: true,
    headline: 'One website. Evidence that gets smarter over time.',
    subhead:
      'FixFlags starts with public evidence, independently verifies important paths, and adds connected context when it changes what you should do.',
    states: [
      {
        id: 'GREEN' as const,
        title: 'Observe',
        body: 'Understand what the public website and real visitor signals can tell you.',
      },
      {
        id: 'RED' as const,
        title: 'Verify',
        body: 'Use FixFlags’ browser to reproduce important paths and independently check the fix.',
      },
      {
        id: 'UNKNOWN' as const,
        title: 'Connect',
        body: 'Add Shopify, Analytics, Search Console, Meta, or deployment context only when it improves an existing answer.',
      },
    ] as const,
  },
  layers: {
    label: 'One system, not a toolbox',
    headlineDisplay: 'Find. Understand. Fix. Verify',
    headlineAccentPeriod: true,
    headline: 'Find. Understand. Fix. Verify.',
    subhead:
      'Monitoring keeps the loop running. Connections enrich the same Site. AI helps operate it.',
    cards: [
      {
        id: 'find',
        title: 'Find',
        question: 'What deserves attention?',
        body: 'Surface the website problems that matter, with evidence rather than a score dump.',
      },
      {
        id: 'understand',
        title: 'Understand',
        question: 'What happened, where, and why?',
        body: 'See the page, path, source, and independent evidence behind each Flag.',
      },
      {
        id: 'fix',
        title: 'Fix',
        question: 'What should change next?',
        body: 'Prioritize the action that removes the most important customer friction first.',
      },
      {
        id: 'verify',
        title: 'Verify',
        question: 'Did the change solve it?',
        body: 'Revisit the live website after a change and keep watching for meaningful regressions.',
      },
    ] as const,
  },
  reportExamples: {
    headline: "Flags you can act on.",
    subhead:
      "Real Flags from the product. The same report shape you get after you paste a URL.",
    seeInSample: "See in sample",
    seeInSampleHref: "/#sample-review",
    cards: [
      {
        id: "messaging",
        topic: "Messaging",
        rubric: "MESSAGE",
        severity: "IMPORTANT",
        problem:
          "Hero headline repeats the product category instead of the outcome",
        evidence:
          "Headline describes the tool category, not the visitor outcome.",
      },
      {
        id: "mobile",
        topic: "Mobile",
        rubric: "EXPERIENCE",
        severity: "CRITICAL",
        problem: "Primary CTA is hidden below the fold on mobile",
        evidence:
          "At 375px, the hero image pushes the main action below the first screen.",
      },
      {
        id: "accessibility",
        topic: "Accessibility",
        rubric: "EXPERIENCE",
        severity: "IMPORTANT",
        problem: "Navigation menu consumes too much viewport height on mobile",
        evidence:
          "Nav bar plus announcement banner take ~280px before content starts.",
      },
      {
        id: "seo",
        topic: "SEO and sharing",
        rubric: "REACH",
        severity: "IMPORTANT",
        problem: "Missing og:image, link previews show blank cards",
        evidence:
          "Shared links show blank preview cards on Slack, X, and WhatsApp.",
      },
    ] as const,
  },
  whyBuildersChoose: {
    label: "Why builders choose FixFlags",
    headlineDisplay: "More than a score. Everything you need to finish",
    headlineAccentPeriod: true,
    headline: "More than a score. Everything you need to finish.",
    subhead:
      "FixFlags turns complex quality signals into clear guidance so you can finish the product your users need.",
    demo: {
      title: "Finish Plan",
      path: "Evidence → fix → verification",
      status: "Live product checked",
      listLabel: "Prioritized Flags",
      flags: [
        {
          title: "Primary CTA below the fold",
          meta: "Experience · Critical",
        },
        {
          title: "Hero outcome stays unclear",
          meta: "Message · Important",
        },
        {
          title: "Social preview has no image",
          meta: "Reach · Important",
        },
      ] as const,
      severity: "Critical · Experience",
      flagTitle: "Primary CTA is below the fold on mobile",
      evidenceStatus: "Live evidence",
      whyTitle: "Why it matters",
      whyBody:
        "On a phone, people cannot see the main action before scrolling. The page delays the exact next step it asks them to take.",
      viewportLabel: "action begins below first viewport",
      promptTitle: "Fix prompt",
      copyAction: "Copy",
      prompt:
        "Move the primary CTA into the first mobile viewport. Preserve the desktop hierarchy. Verify the updated page at 375px and 430px, then report the final CTA position.",
      recheckLabel: "Update review compares the same viewport",
    },
  },
  editorIntegrations: {
    label: "How it works",
    headlineDisplay: "FixFlags in your shipping loop. Always independent",
    headlineAccentPeriod: true,
    headline: "FixFlags in your shipping loop. Always independent.",
    headlineLines: [
      "FixFlags in your shipping loop.",
      "Always independent",
    ] as const,
    body: "Review the live URL, act on clear Flags, and run an update review after you publish.",
    workspace: {
      title: "Product release review",
      meta: "live URL · FixFlags review",
      status: "Reviewed",
      builderLabel: "Your builder",
      userLabel: "You",
      request:
        "Check the live landing page. Fix the first Critical Flag, then run an update review.",
      liveProductNote:
        "FixFlags reads the live product, not the editor preview",
      assistantLabel: "FixFlags",
      assistantStatus: "Live review complete",
      states: [
        {
          id: "flag",
          label: "Flag",
          title: "CTA below fold",
          body: "Evidence captured at the mobile viewport.",
        },
        {
          id: "fix",
          label: "Fix",
          title: "Prompt applied",
          body: "The builder moved the action into view.",
        },
        {
          id: "recheck",
          label: "Update review",
          title: "Review complete",
          body: "A fresh review records what changed and whether evidence supports the Improvement.",
        },
      ] as const,
      verifiedTitle: "Independent result recorded",
      verifiedBody:
        "The verification receipt stays attached to the original Flag.",
      continueLabel: "Copy fix prompt",
    },
  },
  productEvidence: {
    headline: "What a review actually catches",
    subhead: "Real Flags from the product, not quote cards.",
    items: [
      {
        id: "message",
        title: "Message",
        lead: "Visitors should know what you do and why it matters in five seconds.",
        findings: [
          "Hero that never names the outcome",
          "CTA that stays vague",
          "Copy that names the category, not the win",
        ],
      },
      {
        id: "experience",
        title: "Experience",
        lead: "On mobile, the next step should be obvious without hunting.",
        findings: [
          "Main action buried after a long scroll on phone",
          "Tap targets too small to hit cleanly",
          "Layout that hides the next step",
        ],
      },
      {
        id: "reach",
        title: "Reach",
        lead: "When someone shares your link, the card should still look like you.",
        findings: [
          "Link cards that render blank when shared",
          "Missing metadata search cannot use",
          "Sharing cards that drop your brand",
        ],
      },
    ] as const,
    cta: "See a sample review",
    ctaHref: "/#sample-review",
  },
  integrationsBlock: {
    label: "Builder workflow",
    headline: "Start with copy and paste.",
    headlineDisplay: "Start with copy and paste",
    headlineAccentPeriod: true,
    body: "Copy a fix into the AI builder you already use. Publish the change, then run an update review on the live URL.",
    mcpCta: "Read the report guide",
    mcpHref: "/docs/reports",
    cliCta: "See a sample report",
    cliHref: "/samples",
    npxCheckCommand: "https://your-product.com",
    npxCheckLabel: "Product URL",
    npxCheckDescription: "Paste one URL. Get one complete report.",
  },
  sampleReport: {
    label: "Sample review",
    headlineDisplay: "See what gets in your users’ way",
    headlineAccentPeriod: true,
    headline: "See what gets in your users’ way.",
    body: "Explore a curated demo review. See the issues, the evidence behind them, and a fix you can paste into your AI editor.",
    previewEyebrow: "Fix list",
    previewTitle: "Every fix, ranked and ready to apply",
    previewBadge: "Screenshot evidence included",
    exploreCta: "Explore a full report",
    cta: "Explore a full report",
    ctaWithCount: (flagCount: number) => {
      void flagCount;
      return "Explore a full report";
    },
    /** Curated replay of one review inside the living editor chrome. */
    story: {
      label: "FixFlags review story",
      steps: [
        "Experiencing the Product",
        "Noticing what customers encounter",
        "Connecting the observation to evidence",
        "Surfacing a confirmed Flag",
        "Recommending the improvement",
      ] as const,
      evidenceLabel: "Evidence",
      improvementLabel: "Recommended improvement",
      cta: "Explore the full report",
    },
  },
  footer: {
    tagline:
      'FixFlags finds the website problems that matter, shows why they matter, and keeps watching.',
    madeWith: 'Built for businesses that depend on their website.',
    buildersTitle: 'Built for website operators',
    buildersBody:
      'Start with a URL. Add context only when it makes the next decision clearer.',
    buildersCta: "See how it works",
    buildersHref: "/how-it-works",
    newsletter: {
      title: "Stay in the loop",
      placeholder: "Enter your email",
      cta: "Subscribe",
      blurb: "Product updates and shipping tips. No spam.",
      success: "You\u2019re on the list.",
      alreadySubscribed: "You\u2019re already on the list.",
      emailRequired: "Enter your email address",
      subscribeFailed: "Could not subscribe right now. Try again later.",
    },
    social: {
      instagram: "",
    },
  },
} as const;

export const EXAMPLES_PAGE = {
  label: "Examples",
  headline: "Example checks from recognizable sites",
  body: "Real checks from recognizable sites. Each card shows top Flags and what to do next.",
} as const;

export const BLOG_INDEX = {
  label: "Blog",
  headline: "Notes on shipping without the embarrassing bugs",
} as const;

export const ROAST_META = {
  title: "Website Roast - FixFlags",
  description:
    "Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.",
  ogDescription: "Paste your URL. Get roasted. Fix what matters.",
} as const;

export const FIRST_AUDIT_PROMPT = {
  headline: "Paste the URL you are about to share.",
  body: "FixFlags reviews your page before anyone else sees it. You get Flags across Message, Experience, and Reach with evidence. Create a free account for fix prompts you can paste into Cursor, Claude, Lovable, or Bolt.",
  examplesLabel: "Common first checks",
  examples: [
    {
      label: "Your Product Hunt page",
      hint: "producthunt.com/posts/your-product",
    },
    { label: "Your demo day landing page", hint: "yourstartup.com" },
    { label: "A client site before handoff", hint: "clientsite.com" },
  ],
  footerPrefix: "Not sure what to check first?",
  footerLink: "See a sample report",
  footerSuffix: "to know what you will get.",
} as const;
