export const HERO = {
  badge: "Product QA",
  headline: "Finish what your AI started.",
  /** Full headline without the period; period is rendered in brand orange. */
  headlineDisplay: "Finish what your AI started",
  headlineAccentPeriod: true,
  subhead:
    "Paste a URL. Get Flags across Message, Experience, and Reach, with evidence and the next fix for your builder.",
  primaryCta: "Review my site",
  compactPrimaryCta: "Review site",
  trySampleCta: "See a sample review",
  urlPlaceholder: "Paste your site or app URL",
  /** Honest product assurances only. No invented counts or testimonials. */
  assurances: [
    { id: "speed", label: "Results in under 60 seconds", icon: "zap" as const },
    { id: "teaser", label: "3 product reviews included", icon: "shield" as const },
    { id: "private", label: "Your report is private", icon: "lock" as const },
  ],
  /** Product-true trust line only. No invented member counts or stock avatars. */
  trustLine: "Works with Cursor, Claude Code, Lovable, Bolt, and more",
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
    "An update review loop to prove fixes landed",
  ],
  isNot: [
    "Not a generic Lighthouse wrapper",
    "Not manual QA-as-a-service",
    "Not an enterprise test suite",
  ],
  bullets: [
    "AI reads screenshots for message, experience, and reach gaps",
    "Sign up to get a fix prompt for every Flag",
    "Update reviews prove fixes landed",
  ],
  rows: [
    {
      feature: "Says why each Flag hurts conversion",
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
      fixflags: "Yes (Pro)",
    },
    {
      feature: "Public share links for clients",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes (Studio)",
    },
    {
      feature: "Runs inside supported builders",
      lighthouse: "No",
      manual: "No",
      fixflags: "Yes",
    },
  ],
  comparisonRows: [
    {
      feature: "Says why each Flag hurts conversion",
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
  headlineDisplay: "See what your release still needs",
  headlineAccentPeriod: true,
  body: "Free product review. Paste your site or app URL and get your FixFlags report.",
} as const;

export const MCP_SECTION = {
  headline: "Run product reviews from your editor",
  body: "Connect via MCP so your agent pulls Flags and fix prompts, then fixes and runs update reviews without copy-pasting URLs.",
  intro: "A typical prompt sequence looks like this:",
  closing: "Then run an update review to prove the improvement.",
  cta: "See MCP setup",
  workflow: `User: "Check https://myapp.com and review the Experience rubric"

Claude calls: ff_check_and_plan → ff_get_rubric("EXPERIENCE")
Claude: "Experience has two Critical Flags:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls ff_recheck_and_compare
Claude: "Experience has no Critical Flags. Two Flags cleared."`,
} as const;

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: "The AI Gap",
    headline: "AI can build the product. FixFlags checks what it missed.",
    headlineAccentPeriod: true,
    subhead:
      "Run a live URL, review the Flags, copy the fix prompts, then run an update review.",
    primaryCta: "Review my site",
    primaryHref: "/#audit",
    secondaryCta: "Set up MCP",
    secondaryHref: "/docs/integrations#quick-start",
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
        title: "Then run an update review",
        body: "See which Flags cleared after the change.",
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
    label: "Two ways to review",
    title: "Product review vs deep review",
    body:
      "A product review is a fast programmatic pass with screenshot evidence across Message, Experience, and Reach. A deep review sends an agent-class browser through key paths, maps the Funnel, and records playback you can scrub.",
    productReview: {
      title: "Product review",
      body:
        "Playwright-driven capture aligned to checks. Ranked Flags, fix prompts, and evidence you can inspect. Uses your product review credits.",
    },
    deepReview: {
      title: "Deep review",
      body:
        "Agent-level browser exploration: multi-step paths, Funnel traversal, and playback with a timeline synced to evidence. Like a power user session you can replay, not a score dump.",
    },
    docsCta: "Read the deep review guide",
    docsHref: "/docs/deep-review",
    analogyLine:
      "Power-user browsing with replay is the deep review difference. Lighthouse-style checks alone do not walk your signup funnel.",
  },
  loop: {
    label: "The operating loop",
    title: "Flag. Fix. Update review. Repeat when the page changes.",
    steps: [
      {
        title: "Flag",
        body: "Find Flags across Message, Experience, and Reach with evidence you can inspect.",
      },
      {
        title: "Fix",
        body: "Copy the prompt into your builder, or let MCP hand the exact Flag to your coding agent.",
      },
      {
        title: "Update review",
        body: "Run the same URL again, prove the fix landed, and ship when you are ready.",
      },
    ],
  },
  mcp: {
    label: "MCP workflow",
    title: "Your agent reads the same report you do.",
    body: "MCP is the open standard that lets coding agents call outside tools. Connect FixFlags so Live Review and fix prompts land in the editor you already use.",
    setupCta: "Set up MCP",
    setupHref: "/docs/integrations#quick-start",
    plansCta: "See plans",
    plansHref: "/pricing",
    transcript: `User: "Check the landing page and fix the first Critical Flag"

Agent calls: ff_check_and_plan
Agent reads: Experience rubric and top Flag
Agent applies: mobile CTA layout fix
Agent calls: ff_recheck_and_compare
Agent reports: "Experience has no Critical Flags. One Flag cleared."`,
  },
  finalCta: {
    headline: "Close the AI gap on a live URL.",
    body: "Paste your site, get Flags with evidence and fix prompts, then run an update review to see what cleared.",
    primaryCta: "Review my site",
    primaryHref: "/#audit",
    secondaryCta: "Connect MCP",
    secondaryHref: "/docs/integrations#quick-start",
    tryLabel: "Try it on a live URL",
  },
} as const;

export const LANDING_PAGE = {
  logoCloud: {
    label: "Works where you build",
    disclaimer: "",
  },
  checkDimensions: {
    label: "Built to cover what matters",
    headlineDisplay: "Three rubrics. One clear fix list",
    headlineAccentPeriod: true,
    headline: "Three rubrics. One clear fix list.",
    subhead:
      "FixFlags checks Message, Experience, and Reach, then ranks the Flags that need your attention.",
    allChecksTab: "All checks",
    topIssuesTitle: "Top Flags",
    viewAllIssues: "View all Flags",
    viewAllIssuesHref: "/issues",
    exampleFindingLabel: "Example Flag",
    cards: [
      {
        id: "message",
        title: "Message",
        label: "Message",
        panelTitle: "Communicate what matters.",
        question: "Can people understand and care in five seconds?",
        panelBody:
          "We review clarity, hierarchy, and content quality so people understand the value before they decide to leave.",
        icon: "message",
        tint: "brand",
        checks: [
          "Value proposition and audience",
          "Content hierarchy",
          "CTA specificity",
          "Readability and tone",
        ] as const,
        proofExample: {
          finding: "Hero value is unclear",
          evidence: '"Your team deserves better naps"',
        },
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
        question: "Can people use it without friction?",
        panelBody:
          "We test the path from arrival to action across devices so friction does not turn into a lost user.",
        icon: "experience",
        tint: "success",
        checks: [
          "Mobile layout and tap targets",
          "Primary flow completion",
          "Accessibility blockers",
          "Errors, trust, and feedback",
        ] as const,
        proofExample: {
          finding: "Primary CTA below fold at 375px",
          evidence: "Main action starts at 1,200px on mobile",
        },
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
        question: "Can people find and share it?",
        panelBody:
          "We inspect search, metadata, and link previews so every discovery surface represents the product clearly.",
        icon: "reach",
        tint: "info",
        checks: [
          "Titles and descriptions",
          "Social preview coverage",
          "Indexability and canonicals",
          "Structured discovery signals",
        ] as const,
        proofExample: {
          finding: "Social preview image missing",
          evidence: "Link previews show blank on Slack and X",
        },
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
        title: "Update review with confidence",
        body: "A fresh capture proves what changed.",
        icon: "refresh" as const,
      },
    ] as const,
  },
  howItWorks: {
    label: "How it works",
    headlineDisplay: "Three steps from review to fix to verified",
    headlineAccentPeriod: true,
    headline: "Three steps from review to fix to verified.",
    subhead:
      "FixFlags analyzes your product, highlights what matters, and gives you clear fix prompts so you can publish when you are ready.",
    sampleLink: "Explore a full report",
    steps: [
      {
        step: 1,
        title: "Start your product review",
        body: "Paste the live URL you want FixFlags to review.",
      },
      {
        step: 2,
        title: "We review the live product",
        body: "We review your product across Message, Experience, and Reach.",
      },
      {
        step: 3,
        title: "Fix it. Review again.",
        body: "Apply the fixes with our prompts, then run an update review to confirm you are ready.",
      },
    ] as const,
    demo: {
      heading: "Three rubrics. One clear fix.",
      body: "Every Flag stays connected to its evidence, fix prompt, and the Update review that proves the change.",
      reportTitle: "FixFlags report",
      hostname: "yourproduct.com",
      status: "Ready to update review",
      priorityLabel: "Prioritized Flag",
      evidenceLabel: "Evidence captured from the live page",
      promptTitle: "Fix prompt",
      promptStatus: "Ready for your AI editor",
      copyAction: "Copy",
      copyAriaLabel: "Copy example fix prompt",
      prompt:
        "Update the primary action so it appears in the first mobile viewport. Keep the current visual hierarchy, then verify at 375px and 430px before publishing.",
      recheckLabel: "Update review verifies the same path",
    },
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
    label: "How it works (MCP)",
    headlineDisplay: "FixFlags in your workflow. Always in sync",
    headlineAccentPeriod: true,
    headline: "FixFlags in your workflow. Always in sync.",
    headlineLines: ["FixFlags in your workflow.", "Always in sync"] as const,
    body: "Connect FixFlags through MCP. Review each change, act on clear Flags, and Update review the live product.",
    workspace: {
      title: "Product release review",
      meta: "editor · FixFlags MCP",
      status: "Connected",
      builderLabel: "Your builder",
      userLabel: "You",
      request:
        "Check the live landing page. Fix the first Critical Flag, then update review it.",
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
          title: "Verified",
          body: "A fresh capture confirms the Flag is cleared.",
        },
      ] as const,
      verifiedTitle: "Release path verified",
      verifiedBody: "The result stays attached to the original Flag.",
      continueLabel: "Continue in editor",
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
    label: "Works where you build",
    headline: "Works in the editor you already use.",
    headlineDisplay: "Works in the editor you already use",
    headlineAccentPeriod: true,
    body: "Copy a precise fix into any AI builder. On Pro, MCP lets your agent check, apply fixes, and Update review without leaving the editor.",
    mcpCta: "Set up MCP",
    mcpHref: "/docs/integrations#quick-start",
    cliCta: "CLI docs",
    cliHref: "/docs/cli",
    npxCheckCommand: "npx fixflags check https://site.com",
    npxCheckLabel: "Terminal",
    npxCheckDescription: "No signup. No install. Just paste your URL.",
  },
  sampleReport: {
    label: "Sample report",
    headlineDisplay: "See exactly what AI misses",
    headlineAccentPeriod: true,
    headline: "See exactly what AI misses.",
    body: "FixFlags reviews the live product the way users experience it, then turns every Flag into a ranked, editor-ready fix prompt.",
    previewEyebrow: "Fix list",
    previewTitle: "Every fix, ranked and ready to apply",
    previewBadge: "Screenshot evidence included",
    exploreCta: "Explore a full report",
    cta: "Explore a full report",
    ctaWithCount: (flagCount: number) => {
      void flagCount;
      return "Explore a full report";
    },
    rubricRows: [
      {
        id: "message",
        title: "Message",
        body: "Clarity, hierarchy, and content quality.",
        icon: "message" as const,
      },
      {
        id: "experience",
        title: "Experience",
        body: "Usability, flows, and interface quality.",
        icon: "experience" as const,
      },
      {
        id: "reach",
        title: "Reach",
        body: "SEO, performance, and technical health.",
        icon: "reach" as const,
      },
    ] as const,
    trustLabel: "Every report is built on real product signals",
    trustHeadline: "Proof you can act on, not another vanity score.",
    trustBody:
      "FixFlags reviews the live product, ranks what matters, and stays with you through every update review.",
    trustSupportLabel: "Built for the whole fix loop",
    issuesLabel: (count: number) => `${count} Flags in the sample review`,
    checksLabel: (count: number) =>
      `${count} checks across Message, Experience, and Reach`,
    checksMetric: (count: number) => ({
      value: `${count}+`,
      label: "check points",
    }),
    issuesMetric: (count: number) => ({
      value: String(count),
      label: "Flags found",
    }),
    trustMetrics: [
      {
        id: "speed",
        value: "<60s",
        label: "typical review time",
        icon: "zap" as const,
      },
      {
        id: "recheck",
        value: "Prove",
        label: "fixes with update reviews",
        icon: "refresh" as const,
      },
      {
        id: "private",
        value: "Private",
        label: "only you can see",
        icon: "lock" as const,
      },
      {
        id: "teaser",
        value: "3 reviews",
        label: "lifetime on Free",
        icon: "users" as const,
      },
    ] as const,
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

export const REPORT_COPY = {
  workspace: {
    heading: "Your review",
    identityFallback: "Website review",
    status: {
      checking: "Checking",
      completed: "Completed",
      partial: "Partial",
      degraded: "Degraded",
      failed: "Failed",
      unavailable: "Unavailable",
    },
    checkingScope: "Flags appear as they are verified.",
    checkingProgress: (percent: number, detail: string) =>
      `${percent}% · ${detail}`,
    flagsFoundSoFar: (count: number) =>
      `${count} ${count === 1 ? "Flag" : "Flags"} found so far`,
    context: ({
      unresolved,
      checkedScope,
    }: {
      unresolved: number;
      checkedScope: string | null;
    }) => {
      const unresolvedLabel = `${unresolved} unresolved ${unresolved === 1 ? "Flag" : "Flags"}`;
      if (!checkedScope) return `${unresolvedLabel}.`;
      if (/^\d+ pages$/.test(checkedScope)) {
        return `${unresolvedLabel} across ${checkedScope}.`;
      }
      const preposition = checkedScope.includes("release") ? "in" : "on";
      return `${unresolvedLabel} ${preposition} ${checkedScope}.`;
    },
    summaryLabel:
      "Release score, unresolved Flags, score history, and rubric coverage",
    releaseScore: "Release score",
    scoreUnavailable: "Score unavailable",
    unresolvedFlags: "Unresolved Flags",
    criticalFlags: "Critical Flags",
    criticalCount: (count: number) =>
      `${count} Critical ${count === 1 ? "Flag" : "Flags"}`,
    noCriticalFlags: "No Critical Flags",
    rubricCriticalCount: (count: number) => `${count} critical`,
    rubricFlagCount: (count: number, criticalCount: number) => {
      const flagLabel = `${count} ${count === 1 ? "Flag" : "Flags"}`;
      return criticalCount > 0
        ? `${flagLabel} · ${criticalCount} critical`
        : flagLabel;
    },
    showCriticalFlags: (count: number) =>
      `Show ${count} Critical ${count === 1 ? "Flag" : "Flags"}`,
    showRubricFlags: (rubric: string, count: number) =>
      count > 0
        ? `Show ${count} Critical ${count === 1 ? "Flag" : "Flags"} in ${rubric}`
        : `Show all ${rubric} Flags`,
    history: "Score history",
    scanCount: (count: number) => `${count} completed product reviews`,
    firstScan: "First completed product review",
    historyUnavailable: "History appears after the first completed product review.",
    recheckCount: (count: number) =>
      `${count} completed ${count === 1 ? "Update review" : "Update reviews"}`,
    dashboard: {
      latestRelease: "Latest completed release",
      openReport: "Open report",
      topFlags: "Top ranked Flags",
      total: (count: number) => `${count} total`,
      nextActionLabel: "Next action",
      nextActionBody: "Open a Flag, copy its fix, then run an update review on the release.",
      clearReleaseBody:
        "No unresolved Flags remain. Open the report to verify the release details.",
      reviewTopFlag: "Review the top Flag",
      reviewClearRelease: "Review the release",
      rechecks: (count: number) =>
        `${count} completed ${count === 1 ? 'Update review' : 'Update reviews'}`,
      pageDescription: 'Review what changed, copy the right fix, then run an update review.',
    },
    unavailableState: {
      identity: "FixFlags report",
      identityBody: "Report details are not available",
      summaryValue: "Unavailable",
      privateTitle: "This report is private",
      privateBody:
        "Sign in with the account that owns this report, or ask the owner for a new share link.",
      sharedTitle: "This shared report is unavailable",
      sharedBody:
        "The link may have expired, been revoked, or no longer be eligible for sharing. Ask the owner for a new link.",
      returnHome: "Return home",
      reviewSite: "Review my site",
    },
    chat: {
      title: "Agent",
      placeholder: "Ask about this report",
      empty: "Ask what to fix first, or about a Flag on this report.",
      send: "Send",
      unavailable: "Could not reach FixFlags chat right now.",
      notConfigured:
        "Live chat is off for this review. Use a quick prompt below for an instant answer, or open a Flag in the fix list for its evidence and fix prompt.",
      replyFallback:
        "I could not generate a reply. Try asking about a specific Flag.",
      notSignedIn: "Sign in to chat",
      notOwner: "You can only chat on your own reports",
      notFound: "Report not found",
      messageRequired: "Message required",
      cannedExplain: "Explain this Flag",
      cannedFirst: "What should I fix first?",
      cannedHint:
        "Quick prompts give instant answers while live chat is off. Open a Flag in the fix list for its evidence and fix prompt.",
      capReached: (cap: number) =>
        `Free-form chat is capped at ${cap} replies for this review. Open a Flag in the fix list for its evidence and fix prompt, or use the quick prompts below.`,
      historyLabel: "Scan history",
      historyTooltip: "History",
      historyDescription: "Return to an earlier product review.",
      historyEmpty: "Your completed and active scans will appear here.",
      historyError: "Could not load scan history.",
      historyMore: "Load more",
      currentScan: "Current scan",
      currentSession: "Current browser session",
      saveHistory: "Sign in to save this scan and see your review history.",
      signIn: "Sign in",
      newScan: "New scan",
      newScanInstruction: "Paste the page you want me to review.",
      preparing: "I’m preparing this review.",
      loadingConversation: "Loading this conversation…",
      startPlaceholder: "Paste a URL to review",
      startLabel: "URL to review",
      startAction: "Start review",
      startError: "Could not start this review. Check the URL and try again.",
      returnToReport: "Back to this report",
      authBody: "Sign in to ask about the Flags and fixes in this report.",
      retry: "Try again",
      allowanceBody: "You’ve used this month’s Agent allowance. Your report and scan updates remain available.",
      allowanceAction: "Upgrade to continue",
      viewFlag: "View Flag",
      productReview: "Product review",
      updateReview: "Update review",
    },
    playback: {
      label: "Path playback",
      scrubLabel: "Scrub through the review path",
      counter: (current: number, total: number) => `${current}/${total}`,
      stepNumber: (index: number) => `Step ${index}`,
      evidenceTitle: (index: number) => `Step ${index} evidence`,
      closeEvidence: "Close evidence",
      backToLive: "Back to live",
      noScreenshot: "No screenshot was captured for this step.",
      empty: (url: string) =>
        `Browser evidence appears here as FixFlags captures ${url}.`,
    },
    panels: {
      chatTab: "Agent",
      productTab: "Report",
      browserView: "Timeline",
      reportView: "Report",
      canvasView: "Canvas",
      toggleLabel: "Workspace view",
      viewReport: "View report",
      backToAgent: "Back to Agent",
    },
    canvas: {
      title: "Visual Canvas",
      emptyTitle: "Create a Canvas from this report",
      emptyBody:
        "Turn verified scores, Flags, and evidence into a private visual brief you can revise without losing earlier versions.",
      titlePlaceholder: "Canvas title",
      instructionPlaceholder: "What should this Canvas emphasize?",
      create: "Create Canvas",
      revisePlaceholder: "Describe the next revision",
      revise: "Create revision",
      versions: "Versions",
      restore: (version: number) => `Restore version ${version}`,
      loading: "Loading Canvas…",
      loadFailed: "Could not load this Canvas. Try again.",
      saveFailed: "Could not update this Canvas. Try again.",
      retry: "Try again",
      source: "View source",
      score: "Release score",
      scoreUnavailable: "Not scored",
      lockedTitle: "Turn this report into a visual Canvas",
      lockedBody:
        "Upgrade to create private, evidence-grounded visual reports with version history.",
      upgrade: "Upgrade to create a Canvas",
      start: "Create a Canvas from this report.",
    },
    timelineGate: {
      title: "See how FixFlags checked the path",
      body:
        "Sign in to inspect the captured Timeline and replay the evidence behind this report.",
      action: "Sign in to view Timeline",
    },
    journeyRunDeepReview: "Run deep review",
    funnelReplayPath: "Replay path",
    funnelLabel: "Funnel",
  },
  reportFirst: {
    loadingLabel: "Loading report",
    loadingTitle: "Loading report…",
    preparingReport: "Preparing your report while the review runs.",
    capturesTitle: "Page captures",
    capturesBody: "Desktop and mobile views resolve independently.",
    capturesLabel: "Desktop and mobile captures",
    summaryLabel: "Report summary",
    checkingLabel: "Checking",
    unavailableLabel: "Unavailable",
    statusPendingLabel: "Status pending",
    affectedViewport: (device: "desktop" | "mobile") => `Flagged on ${device}`,
    unaffectedViewport: "Not detected for this Flag",
  },
  lovableBolt: {
    heroTitle: "Paste this into Lovable or Bolt",
    heroBody:
      "One click copies a fix prompt tuned for your builder. Publish the change, then run an update review here.",
    defaultToolHint:
      "Choose your builder, copy the fix, paste it into your AI editor.",
  },
  sampleFocused: {
    eyebrow: "Sample fix list",
    title: "See what FixFlags found",
    body: "A reviewed PlantDad report with real evidence and one complete fix prompt.",
    detailsCta: "View the sample report",
  },
  progressive: {
    eyebrow: "Fix list",
    preparingFixList: "Preparing your fix list…",
  },
  recheck: {
    label: "Update review",
    error: "Could not start the update review. Try again.",
  },
  launchGates: {
    title: "Launch gates",
    body: "Five concrete checks from your report evidence. Fix any failed gates before you publish.",
  },
  recheckHint: {
    title: "Next: prove your fixes worked",
    bodyPrefix:
      "Paste the fix prompts into your editor, publish the changes, then select",
    bodySuffix: "above to see which Flags cleared.",
  },
  sampleCta: {
    title: "Run the same check on your site",
    body: "Paste a URL. See Flags across three rubrics. Sign up for fix prompts you can paste into your editor.",
  },
  noFlags: {
    title: "No flags found",
    body: "This check found no Flags.",
  },
  aiPending: {
    title: "Fix prompts generating",
    body: "Generating fix prompts for every flag. This usually takes under a minute.",
    stillPendingTitle: "Fix prompts still generating",
    stillPendingBody:
      "This is taking longer than usual. Refresh the page, or check back in a minute.",
    refreshCta: "Refresh",
  },
  prescriptionUnavailable: {
    title: "Fix prompts unavailable",
  },
  triageUnavailable: {
    title: "AI summary unavailable",
    signupCta: "Sign up to retry",
    retryCta: "Retry AI summary",
  },
  partialReport: {
    title: "Partial report",
    body: "Some optional evidence was unavailable. Unassessed rubrics are left unmeasured rather than inferred.",
  },
  failedChecks: {
    title: "Some checks could not run",
    body: (modules: string[]) => {
      const label =
        modules.length === 1 ? `The ${modules[0]} check` : `${modules.join(", ")} checks`
      return `${label} could not run, so some fixes may be missing from this report.`
    },
  },
  captureLimited: {
    title: "Limited screenshots",
    body: "We could only capture a limited view of this page. Flags still reflect what we could verify.",
  },
  capturePartial: {
    title: "Partial screenshots",
    body: "Desktop or mobile capture was incomplete. Some visual evidence may be missing.",
  },
  pageSpeedPartial: {
    title: "PageSpeed partially available",
    body: (missingRoutes: Array<{ url: string; missing: string[] }>) => {
      const missing = missingRoutes
        .slice(0, 3)
        .map((route) => {
          let label = route.url;
          try {
            const parsed = new URL(route.url);
            label = parsed.pathname === "/" ? "homepage" : parsed.pathname;
          } catch {
            // Keep the stored route label.
          }
          return `${label} (${route.missing.join(" & ")})`;
        })
        .join(", ");
      return `PageSpeed evidence uses the observations captured in this run. Missing coverage: ${missing}.`;
    },
  },
  pageSpeedUnavailable: {
    title: "PageSpeed unavailable",
    body: "No PageSpeed observation completed in this run. Experience Flags use the other captured evidence.",
  },
  topFixes: {
    title: "Top fixes",
    loadingBody: "Ranked fix prompts appear as Flags are verified.",
    readyBody: (count: number) =>
      `${count} ${count === 1 ? "Flag" : "Flags"} ranked by impact. Review every confirmed Flag and its evidence.`,
    copyCta: "Copy top fixes",
    copyLabel: "Top fixes prompt",
    previewToggle: "Preview prompt",
    generating: "Generating fix prompts for every Flag…",
    demonstratedNote:
      "Create a free account to get fix prompts for this report.",
  },
  sectionTitles: {
    allFixes: "All fixes",
    productContract: "Product contract",
    productContractHeading: "What this product appears to do",
    journey: "Funnel",
    flow: "CTA flow test",
    timelineCompleted: "How we checked",
    timelineProgressive: "How FixFlags is checking",
    timelineEmpty: "Review steps will appear as FixFlags checks the page.",
    madeWith: "Made with",
    previews: "Share & search previews",
    remember: "What we proved",
    rememberHint: "Verified on update review. Stays with this product across reviews.",
  },
  stickyNav: {
    topFixes: "Top fixes",
    contract: "Contract",
    remember: "Proved",
    journey: "Funnel",
    flow: "Flow",
    timeline: "Timeline",
    flags: "Fixes",
    stack: "Stack",
    previews: "Previews",
    launch: "Launch",
  },
  explorer: {
    allPages: "All Pages",
    noMatchFilter: "No flags match this filter.",
    checkingIssues: "Checking for Flags…",
    selectFlag: "Select a flag to see evidence and the fix prompt.",
    flagsAppear: "Flags appear here as the review finishes.",
    noFlagsNice: "No flags. Nice work.",
  },
  runYourOwnAudit: "Check your site",
} as const;

export const MADE_WITH_COPY = {
  sectionLabel: "Technology profile",
  title: "Made with",
  checked: "Checked",
  viewEvidence: "View stack and evidence",
  verified: "Verified",
  strongSignal: "Strong signal",
  legacy:
    "Technology signals were not captured for this review. Run an update review to create a verified profile.",
  unavailable:
    "Technology signals were unavailable for this check. The rest of the report is unaffected.",
  empty: "No technologies could be verified from the site’s public signals.",
  partial:
    "Partial profile. Only signals preserved by the historical capture are shown.",
  changed: "Changed since the last update review",
  added: "Added",
  removed: "Removed",
  evidenceChanged: "Evidence changed",
  disclaimer:
    "FixFlags reads public page signals. The report score reflects the site outcome, not the quality of any individual tool.",
  insightWithRubric: (
    stack: string,
    rubric: string,
    score: number,
    flagCount: number,
  ) =>
    `On this ${stack} site, ${rubric} is the lowest-scoring rubric at ${score} with ${flagCount} unresolved ${flagCount === 1 ? "Flag" : "Flags"}.`,
  insightWithScore: (stack: string, score: number) =>
    `This ${stack} site scored ${score}. The score reflects the site outcome, not the tools themselves.`,
  insightCount: (count: number) =>
    `FixFlags verified ${count} public ${count === 1 ? "technology" : "technologies"} on this site.`,
  publicProfileLabel: "Public technology profile",
  publicProfileLead:
    "Public page signals, checked by the same capture that produced this site’s FixFlags report.",
  latestPublicReport: "Latest public report",
  completed: "Completed",
  openPublicReport: "Open the public report",
  relatedProfiles: "Related public profiles",
  ownSitePrompt: "Check your own site’s stack, score, evidence, and fix list.",
  checkAgain: "Run a product review on this site again",
  metaTitle: (hostname: string, technologies: string[]) =>
    `${hostname} is made with ${technologies.slice(0, 3).join(", ")} | FixFlags`,
  metaDescription: (hostname: string) =>
    `Verified public technology signals for ${hostname}, connected to its latest FixFlags score and unresolved Flags.`,
  reportSummary: (score: number | null, flagCount: number) =>
    score === null
      ? `${flagCount} unresolved ${flagCount === 1 ? "Flag" : "Flags"}`
      : `${flagCount} ${flagCount === 1 ? "Flag" : "Flags"}`,
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
