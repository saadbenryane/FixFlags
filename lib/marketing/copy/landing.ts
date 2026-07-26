export const HERO = {
  badge: 'The release readiness layer',
  headline: 'Finish what your AI started.',
  /** Full headline without the period; period is rendered in brand orange. */
  headlineDisplay: 'Finish what your AI started',
  headlineAccentPeriod: true,
  subhead: 'AI builds your product. FixFlags reviews the message, experience, and reach so you ship with confidence.',
  primaryCta: 'Review my site',
  compactPrimaryCta: 'Review site',
  trySampleCta: 'See a sample review',
  urlPlaceholder: 'Paste your site or app URL',
  /** Honest product assurances only. No invented counts or testimonials. */
  assurances: [
    { id: 'speed', label: 'Results in under 60 seconds', icon: 'zap' as const },
    { id: 'teaser', label: '3 checks included free', icon: 'shield' as const },
    { id: 'private', label: 'Your report is private', icon: 'lock' as const },
  ],
  /** Product-true trust line only. No invented member counts or stock avatars. */
  trustLine: 'Trusted by builders shipping with AI',
  scrollHint: 'Scroll to discover',
} as const

export const DIFFERENTIATION = {
  label: 'Why FixFlags',
  headline: 'More than a Lighthouse score',
  subhead: 'Automated checks miss what a reviewer sees in a screenshot.',
  lighthouseLinkText: 'Compare FixFlags checks with Google Lighthouse',
  is: ['A review layer that finishes what your AI started', 'Flags with evidence, impact, and fix prompts', 'A re-check loop to prove fixes landed'],
  isNot: ['Not a generic Lighthouse wrapper', 'Not manual QA-as-a-service', 'Not an enterprise test suite'],
  bullets: ['AI reads screenshots for message, experience, and reach gaps', 'Every Flag comes with a fix prompt', 'Re-checks prove fixes landed'],
  rows: [
    {
      feature: 'Says why each Flag hurts conversion',
      lighthouse: 'Partial',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'AI reads screenshots for UX gaps',
      lighthouse: 'No',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Identifies missing og:image',
      lighthouse: 'Partial',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Checks mobile CTA placement',
      lighthouse: 'No',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Writes fix prompts your agent runs',
      lighthouse: 'No',
      manual: 'No',
      fixflags: 'Yes',
    },
    {
      feature: 'Re-check after fixes',
      lighthouse: 'Manual',
      manual: 'Manual',
      fixflags: 'Built-in',
    },
    {
      feature: 'Before/after comparison',
      lighthouse: 'No',
      manual: 'No',
      fixflags: 'Yes (Pro)',
    },
    {
      feature: 'Public share links for clients',
      lighthouse: 'No',
      manual: 'No',
      fixflags: 'Yes (Studio)',
    },
    {
      feature: 'Runs inside supported builders',
      lighthouse: 'No',
      manual: 'No',
      fixflags: 'Yes',
    },
  ],
  comparisonRows: [
    {
      feature: 'Says why each Flag hurts conversion',
      lighthouse: 'Partial',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'AI reads screenshots for UX gaps',
      lighthouse: 'No',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Identifies missing social preview image',
      lighthouse: 'Partial',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Checks mobile button placement',
      lighthouse: 'No',
      manual: 'Yes',
      fixflags: 'Yes',
    },
    {
      feature: 'Writes fix prompts your agent runs',
      lighthouse: 'No',
      manual: 'No',
      fixflags: 'Yes',
    },
  ],
} as const

export const FINAL_CTA = {
  headlineDisplay: 'Ready to see what\u2019s blocking your release',
  headlineAccentPeriod: true,
  body: 'Free check. Paste your site or app URL and get your FixFlags report.',
} as const

export const MCP_SECTION = {
  headline: 'Run checks from your editor',
  body: 'Connect via MCP so your agent finds Flags, fixes them, and re-checks without copy-pasting URLs.',
  intro: 'A typical prompt sequence looks like this:',
  closing: 'Then re-check to prove the improvement.',
  cta: 'See MCP setup',
  workflow: `User: "Check https://myapp.com and review the Experience rubric"

Claude calls: ff_check_and_plan → ff_get_rubric("EXPERIENCE")
Claude: "Experience needs attention. Two Flags:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls ff_recheck_and_compare
Claude: "Experience improved from Needs Attention → Pass. Two Flags cleared."`,
} as const

export const HOW_IT_WORKS_PAGE = {
  hero: {
    eyebrow: 'The AI Gap',
    headline: 'AI can build products. It still can\u2019t tell you if they\u2019re ready.',
    headlineAccentPeriod: true,
    subhead: 'AI gets you close. FixFlags finds what it missed: the gaps between a draft and a release.',
    primaryCta: 'Review my site',
    primaryHref: '/#audit',
    secondaryCta: 'Set up MCP',
    secondaryHref: '/help/mcp',
    annotations: [
      {
        id: 'ai-build',
        title: 'AI Build',
        percent: '80%',
        body: 'Draft complete. Not shippable yet.',
        tone: 'muted' as const,
      },
      {
        id: 'gap',
        title: 'The Gap',
        percent: '',
        body: 'What AI misses before you ship.',
        tone: 'muted' as const,
      },
      {
        id: 'fixflags',
        title: 'FixFlags',
        percent: '100%',
        body: 'Release ready. Ship with confidence.',
        tone: 'brand' as const,
      },
    ],
    features: [
      {
        title: 'AI builds fast',
        body: 'Ship features, pages, and entire products.',
        icon: 'sparkles' as const,
      },
      {
        title: 'But misses critical signals',
        body: 'Issues that impact trust, performance, and growth.',
        icon: 'warning' as const,
      },
      {
        title: 'FixFlags reviews everything',
        body: 'Message, experience, and reach across every device.',
        icon: 'shield' as const,
      },
      {
        title: 'You fix with confidence',
        body: 'Clear findings, exact fixes, no guesswork.',
        icon: 'check' as const,
      },
      {
        title: 'Then ship, confidently',
        body: 'Because you know your product is actually ready.',
        icon: 'rocket' as const,
      },
    ],
  },
  reportPreview: {
    label: 'What the report gives you',
    title: 'A fix queue, not a score dump.',
    body: 'Each Flag explains what broke, where we saw it, why it matters, and what to paste into your builder.',
    rubricLine: 'Message is what the page says. Experience is how it works. Reach is how people find and share it.',
    sampleLabel: 'Sample Finish Plan',
    sampleCta: 'Explore a full sample',
    sampleHref: '/samples',
    flags: [
      {
        rubric: 'Experience',
        status: 'Needs Attention',
        finding: 'Primary action starts below the first mobile viewport.',
        evidence: 'Mobile screenshot (375px) shows the CTA after 1,080px of scrolling.',
      },
      {
        rubric: 'Reach',
        status: 'Blocked',
        finding: 'The page has no share preview image.',
        evidence: 'Social and Slack previews render as a blank card.',
      },
      {
        rubric: 'Message',
        status: 'Needs Attention',
        finding: 'Hero copy says what the product is, not who it helps.',
        evidence: 'Headline and subhead do not name the buyer, task, or outcome.',
      },
    ],
  },
  loop: {
    label: 'The operating loop',
    title: 'Flag. Fix. Re-check. Repeat when the page changes.',
    steps: [
      {
        title: 'Flag',
        body: 'Find issues that matter across Message, Experience, and Reach with evidence you can trust.',
      },
      {
        title: 'Fix',
        body: 'Copy the prompt into your builder, or let MCP hand the exact Flag to your coding agent.',
      },
      {
        title: 'Re-check',
        body: 'Run the same URL again, prove the fix landed, and ship when you are ready.',
      },
    ],
  },
  mcp: {
    label: 'MCP workflow',
    title: 'Your agent reads the same report you do.',
    body: 'MCP is the open standard that lets coding agents call outside tools. Connect FixFlags so Launch Check and fix prompts land in the editor you already use.',
    setupCta: 'Set up MCP',
    setupHref: '/help/mcp',
    plansCta: 'See plans',
    plansHref: '/pricing',
    transcript: `User: "Check the landing page and fix the highest-impact issue"

Agent calls: ff_check_and_plan
Agent reads: Experience rubric and top Flag
Agent applies: mobile CTA layout fix
Agent calls: ff_recheck_and_compare
Agent reports: "Experience moved to Pass. One Flag cleared."`,
  },
  finalCta: {
    headline: 'Close the AI gap on a live URL.',
    body: 'Paste your site, get Flags with evidence and fix prompts, then re-check until it is ready to ship.',
    primaryCta: 'Review my site',
    primaryHref: '/#audit',
    secondaryCta: 'Connect MCP',
    secondaryHref: '/help/mcp',
    tryLabel: 'Try it on a live URL',
  },
} as const

export const LANDING_PAGE = {
  logoCloud: {
    label: 'Works where you build',
    disclaimer: '',
    logos: ['Lovable', 'Bolt', 'Cursor', 'Replit', 'Claude Code', 'Windsurf', 'Codex'] as const,
  },
  checkDimensions: {
    label: 'Built to cover what matters',
    headlineDisplay: 'Every dimension your product needs to pass',
    headlineAccentPeriod: true,
    headline: 'Every dimension your product needs to pass.',
    subhead: 'FixFlags checks your product across message, experience, and reach so you can fix what counts before users find it.',
    allChecksTab: 'All checks',
    topIssuesTitle: 'Top issues',
    viewAllIssues: 'View all issues',
    viewAllIssuesHref: '/issues',
    exampleFindingLabel: 'Example finding',
    cards: [
      {
        id: 'message',
        title: 'Message',
        label: 'Message',
        panelTitle: 'Communicate what matters.',
        question: 'Can people understand and care in five seconds?',
        panelBody: 'We analyze clarity, hierarchy, and content quality to make sure your message is instantly clear and on-brand.',
        icon: 'message',
        tint: 'brand',
        checks: ['Clarity & value proposition', 'Content hierarchy', 'Tone of voice', 'Readability'] as const,
        proofExample: {
          finding: 'Hero value is unclear',
          evidence: '"Your team deserves better naps"',
        },
        topIssues: [
          {
            title: 'Hero value is unclear',
            severity: 'High',
            body: 'Primary headline does not state the outcome.',
            category: 'message',
            categoryHref: '/issues',
          },
          {
            title: 'CTA stays vague',
            severity: 'Medium',
            body: 'Button copy does not name the next step.',
            category: 'message',
            categoryHref: '/issues',
          },
          {
            title: 'Audience never named',
            severity: 'Medium',
            body: 'Who this is for stays implicit above the fold.',
            category: 'message',
            categoryHref: '/issues',
          },
          {
            title: 'Outcome buried below the fold',
            severity: 'Medium',
            body: 'The result users care about appears too late.',
            category: 'message',
            categoryHref: '/issues',
          },
        ] as const,
      },
      {
        id: 'experience',
        title: 'Experience',
        label: 'Experience',
        panelTitle: 'Make the next step obvious.',
        question: 'Can people use it without friction?',
        panelBody: 'We check mobile layout, flows, accessibility, and trust so visitors can act without friction.',
        icon: 'experience',
        tint: 'success',
        checks: ['Mobile layout and tap targets', 'Primary flow friction', 'Accessibility and performance blockers', 'Trust signals like HTTPS and privacy links'] as const,
        proofExample: {
          finding: 'Primary CTA below fold at 375px',
          evidence: 'Main action starts at 1,200px on mobile',
        },
        topIssues: [
          {
            title: 'Hidden mobile CTA',
            severity: 'High',
            body: 'Primary call-to-action is below the fold on mobile.',
            category: 'experience',
            categoryHref: '/issues',
          },
          {
            title: 'Low contrast text',
            severity: 'Medium',
            body: 'Text contrast ratio fails WCAG AA standards.',
            category: 'experience',
            categoryHref: '/issues',
          },
          {
            title: 'Tap targets too small',
            severity: 'Medium',
            body: 'Primary controls sit under the 44px hit area.',
            category: 'experience',
            categoryHref: '/issues',
          },
          {
            title: 'HTTPS enabled',
            severity: 'Good',
            body: 'Your site is secured with HTTPS.',
            category: 'reach',
            categoryHref: '/issues',
          },
        ] as const,
      },
      {
        id: 'reach',
        title: 'Reach',
        label: 'Reach',
        panelTitle: 'Show up when people share and search.',
        question: 'Can people find and share it?',
        panelBody: 'We check metadata, social previews, and indexability so your link still looks like you.',
        icon: 'reach',
        tint: 'info',
        checks: ['Metadata and canonical basics', 'Social preview readiness', 'Indexability and shareability', 'Search snippets people can understand'] as const,
        proofExample: {
          finding: 'Social preview image missing',
          evidence: 'Link previews show blank on Slack and X',
        },
        topIssues: [
          {
            title: 'Missing og:image',
            severity: 'High',
            body: 'Link previews show a blank card on Slack and X.',
            category: 'reach',
            categoryHref: '/issues',
          },
          {
            title: 'Meta description missing',
            severity: 'Medium',
            body: 'Pages are missing meta descriptions.',
            category: 'reach',
            categoryHref: '/issues',
          },
          {
            title: 'Canonical missing',
            severity: 'Medium',
            body: 'Duplicate URLs are not consolidated.',
            category: 'reach',
            categoryHref: '/issues',
          },
          {
            title: 'Favicon present',
            severity: 'Good',
            body: 'Browser tabs show your mark correctly.',
            category: 'reach',
            categoryHref: '/issues',
          },
        ] as const,
      },
    ] as const,
    values: [
      {
        id: 'aligned',
        title: 'Human-aligned AI',
        body: 'Trained on real product standards, not guesswork.',
        icon: 'shield' as const,
      },
      {
        id: 'evidence',
        title: 'Zero guesswork',
        body: 'Issues backed by evidence and best practices.',
        icon: 'target' as const,
      },
      {
        id: 'fixes',
        title: 'Actionable fixes',
        body: 'Clear guidance you can implement instantly.',
        icon: 'zap' as const,
      },
      {
        id: 'recheck',
        title: 'Re-check with confidence',
        body: 'Verify every fix and watch the status improve.',
        icon: 'refresh' as const,
      },
    ] as const,
  },
  howItWorks: {
    label: 'How it works',
    headlineDisplay: 'Three steps from check to fix to verified',
    headlineAccentPeriod: true,
    headline: 'Three steps from check to fix to verified.',
    subhead: 'FixFlags analyzes your product, highlights what matters, and gives you clear fixes so you can publish when you are ready.',
    sampleLink: 'Explore a full report',
    steps: [
      {
        step: 1,
        title: 'Start your audit',
        body: 'Enter your product URL and run the audit.',
        image: '/marketing/visuals/how-it-works-step-01.webp',
        imageWidth: 280,
        imageHeight: 296,
      },
      {
        step: 2,
        title: 'We check the live product',
        body: 'We check your product across Message, Experience, and Reach.',
        image: '/marketing/visuals/how-it-works-step-02.webp',
        imageWidth: 323,
        imageHeight: 309,
      },
      {
        step: 3,
        title: 'Fix it. Check again.',
        body: 'Apply the fixes with our prompts, then re-check to confirm you are ready.',
        image: '/marketing/visuals/how-it-works-step-03.webp',
        imageWidth: 286,
        imageHeight: 314,
      },
    ] as const,
  },
  reportExamples: {
    headline: 'Flags you can act on.',
    subhead: 'Real findings from the product. Same shape you get after you paste a URL.',
    seeInSample: 'See in sample',
    seeInSampleHref: '/#sample-review',
    cards: [
      {
        id: 'messaging',
        topic: 'Messaging',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        problem: 'Hero headline repeats the product category instead of the outcome',
        evidence: 'Headline describes the tool category, not the visitor outcome.',
      },
      {
        id: 'mobile',
        topic: 'Mobile',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Primary CTA is hidden below the fold on mobile',
        evidence: 'At 375px, the hero image pushes the main action below the first screen.',
      },
      {
        id: 'accessibility',
        topic: 'Accessibility',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Navigation menu consumes too much viewport height on mobile',
        evidence: 'Nav bar plus announcement banner take ~280px before content starts.',
      },
      {
        id: 'seo',
        topic: 'SEO and sharing',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        problem: 'Missing og:image, link previews show blank cards',
        evidence: 'Shared links show blank preview cards on Slack, X, and WhatsApp.',
      },
    ] as const,
  },
  whyBuildersChoose: {
    label: 'Why builders choose FixFlags',
    headlineDisplay: 'More than a score. Everything you need to finish',
    headlineAccentPeriod: true,
    headline: 'More than a score. Everything you need to finish.',
    subhead: 'FixFlags turns complex quality signals into clear guidance so you can finish the product your users need.',
    features: [
      {
        id: 'findings',
        title: 'Clear findings',
        body: 'Plain language issues with real impact.',
        icon: 'sparkles' as const,
      },
      {
        id: 'fixes',
        title: 'Actionable fixes',
        body: 'Copy-ready prompts your AI can use.',
        icon: 'code' as const,
      },
      {
        id: 'priority',
        title: 'Prioritized by impact',
        body: 'Focus on what matters most, first.',
        icon: 'trend' as const,
      },
      {
        id: 'evidence',
        title: 'Evidence you trust',
        body: 'Screenshots and context for every issue.',
        icon: 'shield' as const,
      },
      {
        id: 'recheck',
        title: 'Re-check and improve',
        body: 'Verify every fix and watch your status improve.',
        icon: 'refresh' as const,
      },
    ] as const,
  },
  editorIntegrations: {
    label: 'Works where you build',
    headlineDisplay: 'Seamless in your existing workflow',
    headlineAccentPeriod: true,
    headline: 'Seamless in your existing workflow.',
    body: 'Connect your stack and run audits in seconds. Built for modern builders.',
    moreComing: 'More integrations coming soon',
    workflow: {
      inputs: [
        { id: 'scan', title: 'Scan', icon: 'target' as const },
        { id: 'flag', title: 'Flag', icon: 'shield' as const },
        { id: 'fix', title: 'Fix', icon: 'wrench' as const },
        { id: 'recheck', title: 'Re-check', icon: 'refresh' as const },
      ] as const,
      outputs: [
        { id: 'fixed', title: 'Issues fixed', icon: 'check' as const },
        { id: 'score', title: 'Status improved', icon: 'trend' as const },
        { id: 'ship', title: 'Ready to publish', icon: 'diamond' as const },
      ] as const,
    },
  },
  productEvidence: {
    headline: 'What a review actually catches',
    subhead: 'Real Flags from the product, not quote cards.',
    items: [
      {
        id: 'message',
        title: 'Message',
        lead: 'Visitors should know what you do and why it matters in five seconds.',
        findings: ['Hero that never names the outcome', 'CTA that stays vague', 'Copy that names the category, not the win'],
      },
      {
        id: 'experience',
        title: 'Experience',
        lead: 'On mobile, the next step should be obvious without hunting.',
        findings: ['Main action buried after a long scroll on phone', 'Tap targets too small to hit cleanly', 'Layout that hides the next step'],
      },
      {
        id: 'reach',
        title: 'Reach',
        lead: 'When someone shares your link, the card should still look like you.',
        findings: ['Link cards that render blank when shared', 'Missing metadata search cannot use', 'Sharing cards that drop your brand'],
      },
    ] as const,
    cta: 'See a sample review',
    ctaHref: '/#sample-review',
  },
  sampleReport: {
    label: 'Sample report',
    headlineDisplay: 'See exactly what AI misses',
    headlineAccentPeriod: true,
    headline: 'See exactly what AI misses.',
    body: 'FixFlags scans your live product the way your users experience it and turns issues into clear, actionable fixes.',
    previewEyebrow: 'Fix list',
    previewTitle: 'Every fix, ranked and ready',
    previewBadge: 'Screenshot evidence included',
    exploreCta: 'Explore a full report',
    cta: 'Explore a full report',
    ctaWithCount: (flagCount: number) => {
      void flagCount
      return 'Explore a full report'
    },
    rubricRows: [
      {
        id: 'message',
        title: 'Message',
        body: 'Clarity, hierarchy, and content quality.',
        icon: 'message' as const,
      },
      {
        id: 'experience',
        title: 'Experience',
        body: 'Usability, flows, and interface quality.',
        icon: 'experience' as const,
      },
      {
        id: 'reach',
        title: 'Reach',
        body: 'SEO, performance, and technical health.',
        icon: 'reach' as const,
      },
    ] as const,
    trustLabel: 'Every report is built on real product signals',
    issuesLabel: (count: number) => `${count} issues in the sample review`,
    checksLabel: (count: number) => `${count} checks across Message, Experience, and Reach`,
    checksShortLabel: (count: number) => `Checked ${count}+ points`,
    checksMetric: (count: number) => ({
      value: `${count}+`,
      label: 'checks performed',
    }),
    issuesMetric: (count: number) => ({
      value: String(count),
      label: 'issues found',
    }),
    trustMetrics: [
      {
        id: 'speed',
        value: '<60s',
        label: 'typical scan time',
        icon: 'zap' as const,
      },
      {
        id: 'recheck',
        value: 'Unlimited',
        label: 're-checks',
        icon: 'refresh' as const,
      },
      {
        id: 'private',
        value: 'Private',
        label: 'only you can see',
        icon: 'lock' as const,
      },
      {
        id: 'teaser',
        value: '3 checks',
        label: 'included on Free',
        icon: 'users' as const,
      },
    ] as const,
    /** Decorative homepage dashboard chrome. Product-true labels only. */
    mock: {
      sampleFinishPlan: 'Sample Finish Plan',
      share: 'Share report',
      recheck: 'Re-check',
      releaseReadiness: 'Release status',
      scoreDenom: '/100',
      highImpact: 'High impact issues',
      needsAttention: 'Needs attention',
      byRubric: 'By rubric',
      allIssues: (count: number) => `All issues ${count}`,
      messageTab: (count: number) => `Message ${count}`,
      experienceTab: (count: number) => `Experience ${count}`,
      reachTab: (count: number) => `Reach ${count}`,
      whyItMatters: 'Why it matters',
      impact: 'Impact',
      fixPrompt: 'Fix prompt',
      copyPrompt: 'Copy prompt',
      viewAll: (count: number) => `View all ${count} issues →`,
      fixPromptFallback: 'Open the sample report to copy the full fix prompt.',
    },
  },
  footer: {
    tagline: 'Independent product verification for AI-built products. We check what blocks the release so you can fix it.',
    madeWith: 'Built for people shipping with AI.',
    buildersTitle: 'Built for builders',
    buildersBody: 'FixFlags works where you build. Paste fixes into the editor you already use.',
    buildersCta: 'See how it works',
    buildersHref: '/how-it-works',
    newsletter: {
      title: 'Stay in the loop',
      placeholder: 'Enter your email',
      cta: 'Subscribe',
      blurb: 'Product updates and shipping tips. No spam.',
      success: 'You\u2019re on the list.',
      alreadySubscribed: 'You\u2019re already on the list.',
      emailRequired: 'Enter your email address',
      subscribeFailed: 'Could not subscribe right now. Try again later.',
    },
    social: {
      instagram: '',
    },
  },
} as const

export const REPORT_COPY = {
  reportFirst: {
    loadingLabel: 'Loading report',
    loadingTitle: 'Loading report…',
    openingReport: 'Opening your report while the check is created.',
    retrievingReport: 'Retrieving the latest saved report state.',
    capturesTitle: 'Page captures',
    capturesBody: 'Desktop and mobile views resolve independently.',
    capturesLabel: 'Desktop and mobile captures',
    summaryLabel: 'Report summary',
    unresolvedLabel: 'Unresolved',
    readinessLabel: 'Readiness',
    checkingLabel: 'Checking',
    calculatingLabel: 'Calculating',
    unavailableLabel: 'Unavailable',
    statusPendingLabel: 'Status pending',
    overallUnavailableLabel: 'Overall status unavailable',
    affectedViewport: (device: 'desktop' | 'mobile') => `Flagged on ${device}`,
    unaffectedViewport: 'Not detected for this Flag',
  },
  lovableBolt: {
    heroTitle: 'Paste this into Lovable or Bolt',
    heroBody: 'One click copies a fix prompt tuned for your builder. Publish the change, then re-check here.',
    defaultToolHint: 'Choose your builder, copy the fix, paste it into your AI editor.',
  },
  sampleFocused: {
    eyebrow: 'Sample fix list',
    title: 'See every fix FixFlags found',
    body: 'A versioned, reviewed snapshot from a completed PlantDad demo audit.',
    detailsCta: 'View the sample report',
    completeList: 'This sample includes the complete ranked fix list.',
  },
  progressive: {
    eyebrow: 'Fix list',
    preparingFixList: 'Preparing your fix list…',
  },
  recheck: {
    label: 'Re-check',
    error: 'Could not start the re-check. Try again.',
  },
  launchGates: {
    title: 'Launch gates',
    body: 'Five concrete checks from your report evidence. Fix any failed gates before you publish.',
  },
  recheckHint: {
    title: 'Next: prove your fixes worked',
    bodyPrefix: 'Paste the fix prompts into your editor, publish the changes, then select',
    bodySuffix: 'above to see which Flags cleared.',
  },
  sampleCta: {
    title: 'Run the same check on your site',
    body: 'Paste a URL. See Flags across three rubrics. Sign up for fix prompts you can paste into your editor.',
  },
  noFlags: {
    title: 'No flags found',
    body: 'This scan did not surface any issues. Nice work.',
  },
  aiPending: {
    title: 'Fix prompts generating',
    body: 'Generating fix prompts for every flag. This usually takes under a minute.',
    stillPendingTitle: 'Fix prompts still generating',
    stillPendingBody: 'This is taking longer than usual. Refresh the page, or check back in a minute.',
    refreshCta: 'Refresh',
  },
  prescriptionUnavailable: {
    title: 'Fix prompts unavailable',
  },
  triageUnavailable: {
    title: 'AI summary unavailable',
    signupCta: 'Sign up to retry',
    retryCta: 'Retry AI summary',
  },
  partialReport: {
    title: 'Partial report',
    body: 'Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than being inferred.',
  },
  captureLimited: {
    title: 'Limited screenshots',
    body: 'We could only capture a limited view of this page. Flags still reflect what we could verify.',
  },
  capturePartial: {
    title: 'Partial screenshots',
    body: 'Desktop or mobile capture was incomplete. Some visual evidence may be missing.',
  },
  pageSpeedPartial: {
    title: 'PageSpeed partially available',
    body: (missingRoutes: Array<{ url: string; missing: string[] }>) => {
      const missing = missingRoutes
        .slice(0, 3)
        .map((route) => {
          let label = route.url
          try {
            const parsed = new URL(route.url)
            label = parsed.pathname === '/' ? 'homepage' : parsed.pathname
          } catch {
            // Keep the stored route label.
          }
          return `${label} (${route.missing.join(' & ')})`
        })
        .join(', ')
      return `PageSpeed findings use the observations captured in this run. Missing coverage: ${missing}.`
    },
  },
  pageSpeedUnavailable: {
    title: 'PageSpeed unavailable',
    body: 'No PageSpeed observation completed in this run. Experience findings below use the other captured evidence.',
  },
  sectionTitles: {
    allFixes: 'All fixes',
    productContract: 'Product contract',
    productContractHeading: 'What this product appears to do',
    journey: 'User journey walk',
    flow: 'CTA flow test',
    timelineCompleted: 'How we checked',
    timelineProgressive: 'How FixFlags is checking',
    timelineEmpty: 'Scan steps will appear as FixFlags checks the page.',
    madeWith: 'Made with',
    previews: 'Share & search previews',
    remember: 'What we proved',
    rememberHint: 'Verified on re-check. Stays with this product across scans.',
  },
  stickyNav: {
    contract: 'Contract',
    remember: 'Proved',
    journey: 'Journey',
    flow: 'Flow',
    timeline: 'Timeline',
    flags: 'Fixes',
    stack: 'Stack',
    previews: 'Previews',
    launch: 'Launch',
  },
  explorer: {
    allPages: 'All Pages',
    noMatchFilter: 'No flags match this filter.',
    checkingIssues: 'Checking for issues…',
    selectFlag: 'Select a flag to see evidence and the fix prompt.',
    flagsAppear: 'Flags appear here as the scan finishes.',
    noFlagsNice: 'No flags. Nice work.',
  },
  runYourOwnAudit: 'Run your own audit',
} as const

export const MADE_WITH_COPY = {
  sectionLabel: 'Technology profile',
  title: 'Made with',
  checked: 'Checked',
  viewEvidence: 'View stack and evidence',
  verified: 'Verified',
  strongSignal: 'Strong signal',
  legacy: 'Technology signals were not captured for this audit. Run a re-check to create a verified profile.',
  unavailable: 'Technology signals were unavailable for this scan. The rest of the report is unaffected.',
  empty: 'No technologies could be verified from the site’s public signals.',
  partial: 'Partial profile. Only signals preserved by the historical capture are shown.',
  changed: 'Changed since the last re-check',
  added: 'Added',
  removed: 'Removed',
  evidenceChanged: 'Evidence changed',
  disclaimer: 'FixFlags reads public page signals. The report score reflects the site outcome, not the quality of any individual tool.',
  insightWithRubric: (stack: string, rubric: string, score: number, flagCount: number) =>
    `On this ${stack} site, ${rubric} is the lowest-scoring rubric at ${score} with ${flagCount} unresolved ${flagCount === 1 ? 'Flag' : 'Flags'}.`,
  insightWithScore: (stack: string, score: number) => `This ${stack} site scored ${score}. The score reflects the site outcome, not the tools themselves.`,
  insightCount: (count: number) => `FixFlags verified ${count} public ${count === 1 ? 'technology' : 'technologies'} on this site.`,
  publicProfileLabel: 'Public technology profile',
  publicProfileLead: 'Public page signals, checked by the same capture that produced this site’s FixFlags report.',
  latestPublicReport: 'Latest public report',
  completed: 'Completed',
  openPublicReport: 'Open the public report',
  relatedProfiles: 'Related public profiles',
  ownSitePrompt: 'Check your own site’s stack, score, evidence, and fix list.',
  checkAgain: 'Check this site again',
  metaTitle: (hostname: string, technologies: string[]) => `${hostname} is made with ${technologies.slice(0, 3).join(', ')} | FixFlags`,
  metaDescription: (hostname: string) => `Verified public technology signals for ${hostname}, connected to its latest FixFlags score and unresolved Flags.`,
  reportSummary: (score: number | null, flagCount: number) => (score === null ? `${flagCount} unresolved ${flagCount === 1 ? 'Flag' : 'Flags'}` : `${flagCount} ${flagCount === 1 ? 'Flag' : 'Flags'}`),
} as const

export const EXAMPLES_PAGE = {
  label: 'Examples',
  headline: 'Example audits from recognizable sites',
  body: 'Real audit output from recognizable sites. Each card shows top issues and fix prompts.',
} as const

export const BLOG_INDEX = {
  label: 'Blog',
  headline: 'Notes on shipping without the embarrassing bugs',
} as const

export const ROAST_META = {
  title: 'Website Roast - FixFlags',
  description: 'Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.',
  ogDescription: 'Paste your URL. Get roasted. Fix what matters.',
} as const

export const FIRST_AUDIT_PROMPT = {
  headline: 'Paste the URL you are about to share.',
  body: 'FixFlags reviews your page before anyone else sees it. You get Flags across Message, Experience, and Reach with evidence. Create a free account for fix prompts you can paste into Cursor, Claude, Lovable, or Bolt.',
  examplesLabel: 'Common first checks',
  examples: [
    {
      label: 'Your Product Hunt page',
      hint: 'producthunt.com/posts/your-product',
    },
    { label: 'Your demo day landing page', hint: 'yourstartup.com' },
    { label: 'A client site before handoff', hint: 'clientsite.com' },
  ],
  footerPrefix: 'Not sure what to check first?',
  footerLink: 'See a sample report',
  footerSuffix: 'to know what you will get.',
} as const
