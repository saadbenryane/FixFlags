export const HERO = {
  badge: "Product QA",
  headline: "Finish what your AI started.",
  /** Full headline without the period; period is rendered in brand orange. */
  headlineDisplay: "Finish what your AI started",
  headlineAccentPeriod: true,
  subhead:
    "Review a live product, see the most important problems with evidence, and copy a fix into your AI editor.",
  primaryCta: "Review my site",
  compactPrimaryCta: "Review site",
  trySampleCta: "See a sample review",
  urlPlaceholder: "yourproduct.com",
  /** Product-true trust line only. No invented member counts or stock avatars. */
  trustLine: "Works with your favourite vibe coding tools",
  scrollHint: "Scroll to discover",
} as const;

export const DIFFERENTIATION = {
  label: "Why FixFlags",
  headline: "More than a Lighthouse score",
  subhead: "Automated checks miss what a reviewer sees in a screenshot.",
  lighthouseLinkText: "Compare FixFlags checks with Google Lighthouse",
  is: [
    "A review layer that finishes what your AI started",
    "Flags with evidence, impact, and a demonstrated fix prompt",
    "Update reviews show what changed after you publish",
  ],
  isNot: [
    "Not a generic Lighthouse wrapper",
    "Not manual QA-as-a-service",
    "Not an enterprise test suite",
  ],
  bullets: [
    "AI reads screenshots for message, experience, and reach gaps",
    "Sign up to get a fix prompt for every Flag",
    "Update reviews compare the live product after a change",
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
      feature: "Identifies missing social preview image",
      lighthouse: "Partial",
      manual: "Yes",
      fixflags: "Yes",
    },
    {
      feature: "Checks mobile button placement",
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
  ],
} as const;

export const FINAL_CTA = {
  headlineDisplay: "Paste a URL. See what to fix",
  headlineAccentPeriod: true,
  body: "Get a ranked Product Review with evidence from the live page.",
} as const;

export const BUILDER_WORKFLOW_SECTION = {
  headline: "Fix the highest-impact Flag first",
  body: "Copy the evidence-backed fix prompt into the builder you already use. Publish the change, then run an update review for independent verification.",
  intro: "The workflow stays focused:",
  closing: "The fresh review records what changed and what still needs work.",
  cta: "See how it works",
  workflow: `1. Paste the live URL into FixFlags.
2. Inspect the highest-impact Flag and its evidence.
3. Copy the fix prompt into your builder.
4. Publish the change.
5. Run an update review and compare the result.`,
} as const;

/** @deprecated Internal compatibility alias; the section is URL-first and contains no MCP offer. */
export const MCP_SECTION = BUILDER_WORKFLOW_SECTION;

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: "The AI Gap",
    headline: "AI can build the product. FixFlags checks what it missed.",
    headlineAccentPeriod: true,
    subhead:
      "Run a live URL, review the Flags, copy the fix prompts, then run an update review.",
    primaryCta: "Review my site",
    primaryHref: "/#audit",
    secondaryCta: "See a full report",
    secondaryHref: "/samples",
    annotations: [
      {
        id: "ai-build",
        title: "AI Build",
        percent: "",
        body: "The draft is live.",
        tone: "muted" as const,
      },
      {
        id: "gap",
        title: "The Gap",
        percent: "",
        body: "The unchecked details.",
        tone: "muted" as const,
      },
      {
        id: "fixflags",
        title: "FixFlags",
        percent: "",
        body: "Flags, evidence, and fix prompts.",
        tone: "brand" as const,
      },
    ],
    features: [
      {
        title: "AI builds fast",
        body: "Ship features, pages, and entire products.",
        icon: "sparkles" as const,
      },
      {
        title: "But misses critical signals",
        body: "Flags that affect trust, performance, and reach.",
        icon: "warning" as const,
      },
      {
        title: "FixFlags checks the live result",
        body: "Message, Experience, and Reach on desktop and mobile.",
        icon: "shield" as const,
      },
      {
        title: "You get the next fix",
        body: "Clear evidence and a prompt for your builder.",
        icon: "check" as const,
      },
      {
        title: "Run an update review",
        body: "See which Flags are no longer observed and inspect the verification receipts.",
        icon: "rocket" as const,
      },
    ],
  },
  reportPreview: {
    label: "What the report gives you",
    title: "A fix queue, not a score dump.",
    body: "Each Flag explains what broke, where we saw it, why it matters, and what to paste into your builder.",
    rubricLine:
      "Message is what the page says. Experience is how it works. Reach is how people find and share it.",
    sampleLabel: "Sample Finish Plan",
    sampleCta: "Explore a full sample",
    sampleHref: "/samples",
    flags: [
      {
        rubric: "Experience",
        severity: "Important",
        finding: "Primary action starts below the first mobile viewport.",
        evidence:
          "Mobile screenshot (375px) shows the CTA after 1,080px of scrolling.",
      },
      {
        rubric: "Reach",
        severity: "Critical",
        finding: "The page has no share preview image.",
        evidence: "Social and Slack previews render as a blank card.",
      },
      {
        rubric: "Message",
        severity: "Important",
        finding: "Hero copy says what the product is, not who it helps.",
        evidence:
          "Headline and subhead do not name the buyer, task, or outcome.",
      },
    ],
  },
  reviewTypes: {
    label: "One complete review",
    title: "No depth tier. No second review product.",
    body: "Every Product Review checks the live URL across Message, Experience, and Reach, then gives you one ranked Fix List with evidence and fix prompts.",
    completeReview: {
      title: "What every review includes",
      body: "Live desktop and mobile capture, key-page checks, ranked Flags, evidence, and fix prompts you can paste into your builder.",
    },
    verification: {
      title: "How you verify the fix",
      body: "Publish the change, then use another Product Review as an update review. FixFlags captures the live result again and shows what changed.",
    },
    docsCta: "Read the Product Review guide",
    docsHref: "/docs/reports",
    analogyLine:
      "New URLs, update reviews, and completed Watch reviews all use the same Product Review allowance.",
  },
  loop: {
    label: "The operating loop",
    title: "Review. Fix. Verify. Keep watch.",
    steps: [
      {
        title: "Flag",
        body: "Find Flags across Message, Experience, and Reach with evidence you can inspect.",
      },
      {
        title: "Fix",
        body: "Copy the evidence-backed prompt into the builder you already use.",
      },
      {
        title: "Update review",
        body: "Review the live URL again and see what changed after you publish.",
      },
    ],
  },
  mcp: {
    label: "Builder workflow",
    title: "Take one evidence-backed fix at a time.",
    body: "Copy a focused fix prompt from the report into the builder you already use. Publish when you are ready, then let FixFlags independently review the live result.",
    setupCta: "Read the report guide",
    setupHref: "/docs/reports",
    plansCta: "See plans",
    plansHref: "/pricing",
    transcript: `FixFlags: "The primary action falls below the fold on mobile."
You: copy the focused fix prompt into your builder
Builder: applies the mobile CTA layout fix
You: publish the change and run an update review
FixFlags: "The original evidence is no longer observed. Open the comparison for details."`,
  },
  finalCta: {
    headline: "Close the AI gap on a live URL.",
    body: "Paste your site, get Flags with evidence and fix prompts, then run an update review to see what changed.",
    primaryCta: "Review my site",
    primaryHref: "/#audit",
    secondaryCta: "See a full report",
    secondaryHref: "/samples",
    tryLabel: "Try it on a live URL",
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
    label: "How it works",
    headlineDisplay: "Find the issues. Fix them. See what improved",
    headlineAccentPeriod: true,
    headline: "Find the issues. Fix them. See what improved.",
    subhead:
      "From live page to evidence-backed fix, every step stays connected.",
    sampleLink: "Explore a full report",
    steps: [
      {
        step: 1,
        title: "Show us the real product",
        body: "Paste the live URL. FixFlags experiences the page on desktop and mobile.",
      },
      {
        step: 2,
        title: "See what matters first",
        body: "Get the highest-impact Flags in order, each tied to the screen and behavior behind it.",
      },
      {
        step: 3,
        title: "Fix it. Check it again",
        body: "Take the fix to your AI editor, publish it, then run a fresh update review.",
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
      "Product QA for AI-built products. We review what blocks the release so you can fix it.",
    madeWith: "Built for people shipping with AI.",
    buildersTitle: "Built for builders",
    buildersBody:
      "FixFlags works where you build. Paste fixes into the editor you already use.",
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
  headline: "Example reports from recognizable sites",
  body: "Real reports from recognizable sites. Each card shows top Flags and a fix prompt.",
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
