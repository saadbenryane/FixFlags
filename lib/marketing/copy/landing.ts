

export const HERO = {
  badge: 'Check before you ship.',
  headline: 'Finish what your AI started.',
  headlineLine1: 'what your',
  headlineLine2: 'AI started.',
  headlineAccent: 'Finish',
  headlineAccentLegacy: false,
  subhead:
    'Paste your URL from Lovable, Bolt, or any stack. Find what AI missed before your users do, then copy fixes back into your editor.',
  primaryCta: 'Review my site',
  compactPrimaryCta: 'Review site',
  trySampleCta: 'See a sample review',
  urlPlaceholder: 'your-site.com',
} as const

export const DIFFERENTIATION = {
  label: 'Why FixFlags',
  headline: 'More than a Lighthouse score',
  subhead: 'Automated checks miss what a reviewer sees in a screenshot.',
  lighthouseLinkText: 'Compare FixFlags checks with Google Lighthouse',
  is: [
    'A review layer that finishes what your AI started',
    'Flags with evidence, impact, and fix prompts',
    'A re-check loop to prove fixes landed',
  ],
  isNot: [
    'Not a generic Lighthouse wrapper',
    'Not manual QA-as-a-service',
    'Not an enterprise test suite',
  ],
  bullets: [
    'AI reads screenshots for message, experience, and reach gaps',
    'Every Flag ships with a fix prompt',
    'Re-checks prove fixes landed',
  ],
  rows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing og:image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile CTA placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
    { feature: 'Re-check after fixes', lighthouse: 'Manual', manual: 'Manual', fixflags: 'Built-in' },
    { feature: 'Before/after comparison', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Pro)' },
    { feature: 'Public share links for clients', lighthouse: 'No', manual: 'No', fixflags: 'Yes (Agency)' },
    { feature: 'Runs inside supported builders', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
  ],
  comparisonRows: [
    { feature: 'Says why each Flag hurts conversion', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'AI reads screenshots for UX gaps', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Identifies missing social preview image', lighthouse: 'Partial', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Checks mobile button placement', lighthouse: 'No', manual: 'Yes', fixflags: 'Yes' },
    { feature: 'Writes fix prompts your agent runs', lighthouse: 'No', manual: 'No', fixflags: 'Yes' },
  ],
} as const

export const FINAL_CTA = {
  headline: 'Paste your URL.',
  headlineAccent: 'See what to fix.',
  body: 'Free check. See what\u2019s broken before you share the link. Sign up when you want the fix prompts and re-check.',
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
    eyebrow: 'How FixFlags works',
    headline: 'Check your site from the browser or your coding agent.',
    subhead:
      'Paste a URL for an instant report. Or connect MCP and let Cursor, Claude Code, Windsurf, Lovable, or Bolt find Flags, apply the fixes, and re-check the page.',
    primaryCta: 'Run a browser check',
    secondaryCta: 'Set up MCP',
  },
  modes: [
    {
      label: 'On the site',
      title: 'Paste a URL and get the report',
      body: 'Use the web app when you want a fast outside-in review of a live page, preview deploy, or client URL.',
      bullets: [
        'Message, Experience, and Reach rubrics',
        'Desktop and mobile evidence',
        'Pass / Needs Attention / Blocked status',
      ],
      cta: 'Review my site',
      href: '/#audit',
    },
    {
      label: 'In your editor',
      title: 'Let your agent call FixFlags with MCP',
      body: 'Use MCP when you want the fix loop to stay inside Cursor, Claude Code, Windsurf, Lovable, or Bolt.',
      bullets: [
        'Check a URL from chat',
        'Fetch the exact flag and fix prompt',
        'Re-check after the agent applies changes',
      ],
      cta: 'View MCP setup',
      href: '/docs/mcp',
    },
  ],
  reportPreview: {
    label: 'What the report gives you',
    title: 'A fix queue, not a score dump.',
    body: 'Each Flag explains what broke, where we saw it, why it matters, and what to paste into your builder.',
    rubricLine:
      'Message is what the page says. Experience is how it works. Reach is how people find and share it.',
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
    title: 'Scan, fix, re-check. Repeat when the page changes.',
    steps: [
      {
        title: 'Scan the public page',
        body: 'FixFlags loads the page like a user, captures evidence, and scores Message, Experience, and Reach.',
      },
      {
        title: 'Send the fix to your builder',
        body: 'Copy the prompt manually or let MCP hand the exact Flag to your coding agent.',
      },
      {
        title: 'Re-check the shipped change',
        body: 'Run the same URL again and keep the history in your dashboard.',
      },
    ],
  },
  mcp: {
    label: 'MCP workflow',
    title: 'Your agent reads the same report you do.',
    body: 'MCP is the open standard that lets coding agents call outside tools. Connect FixFlags so Launch Check and fix prompts land in the editor you already use.',
    transcript: `User: "Check the landing page and fix the highest-impact issue"

Agent calls: ff_check_and_plan
Agent reads: Experience rubric and top Flag
Agent applies: mobile CTA layout fix
Agent calls: ff_recheck_and_compare
Agent reports: "Experience moved to Pass. One Flag cleared."`,
  },
  finalCta: {
    headline: 'Start in the browser. Graduate to MCP when the loop is working.',
    body: 'The same report powers both workflows, so your team can review manually today and automate the fix loop tomorrow.',
    primaryCta: 'Review my site',
    secondaryCta: 'Connect MCP',
  },
} as const

export const LANDING_PAGE = {
  logoCloud: {
    label: 'Paste fixes into the tools you already use',
    disclaimer: '',
    logos: ['Cursor', 'Lovable', 'Bolt', 'Replit', 'Claude Code', 'Codex', 'Windsurf'] as const,
  },
  checkDimensions: {
    label: '',
    headline: 'What your page says, how it works, and whether it can be found.',
    exampleFindingLabel: 'Example finding',
    cards: [
      {
        id: 'message',
        title: 'Message',
        question: 'Can people understand and care in five seconds?',
        icon: 'message',
        tint: 'brand',
        checks: [
          'Clarity in the first five seconds',
          'Positioning that names the audience',
          'Copy and story that make the next step obvious',
          'CTA and proof that reduce hesitation',
        ] as const,
        proofExample: {
          finding: 'Hero value is unclear',
          evidence: '"Your team deserves better naps"',
        },
      },
      {
        id: 'experience',
        title: 'Experience',
        question: 'Can people use it without friction?',
        icon: 'experience',
        tint: 'success',
        checks: [
          'Mobile layout and tap targets',
          'Primary flow friction',
          'Accessibility and performance blockers',
          'Trust signals like HTTPS and privacy links',
        ] as const,
        proofExample: {
          finding: 'Primary CTA below fold at 375px',
          evidence: 'Main action starts at 1,200px on mobile',
        },
      },
      {
        id: 'reach',
        title: 'Reach',
        question: 'Can people find and share it?',
        icon: 'reach',
        tint: 'info',
        checks: [
          'Metadata and canonical basics',
          'Social preview readiness',
          'Indexability and shareability',
          'Search snippets people can understand',
        ] as const,
        proofExample: {
          finding: 'Social preview image missing',
          evidence: 'Link previews show blank on Slack and X',
        },
      },
    ] as const,
  },
  howItWorks: {
    label: 'How it works',
    headline: 'Three steps. Then re-check.',
    subhead:
      'Paste a URL. Get Flags. Copy fixes into your editor. Re-check to prove it landed.',
    sampleLink: 'View full sample review',
    steps: [
      {
        step: 1,
        title: 'Flag',
        body: 'We check your page across what it says, how it works, and how it\u2019s found.',
        preview: 'yourproduct.com',
      },
      {
        step: 2,
        title: 'Fix',
        body: 'Copy the fix prompt into Cursor, Claude, Lovable, or Bolt.',
        preview: 'Paste → ship',
      },
      {
        step: 3,
        title: 'Re-check',
        body: 'Run the same URL to see which Flags cleared.',
        preview: 'Re-check complete',
        previewBadge: 'Improved',
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
        evidence:
          'Headline describes the tool category, not the visitor outcome.',
      },
      {
        id: 'mobile',
        topic: 'Mobile',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        problem: 'Primary CTA is hidden below the fold on mobile',
        evidence:
          'At 375px, the hero image pushes the main action below the first screen.',
      },
      {
        id: 'accessibility',
        topic: 'Accessibility',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        problem: 'Navigation menu consumes too much viewport height on mobile',
        evidence:
          'Nav bar plus announcement banner take ~280px before content starts.',
      },
      {
        id: 'seo',
        topic: 'SEO and sharing',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        problem: 'Missing og:image, link previews show blank cards',
        evidence:
          'Shared links show blank preview cards on Slack, X, and WhatsApp.',
      },
    ] as const,
  },
  whyAiNeedsFixFlags: {
    headline: 'AI ships the build. FixFlags checks the first visit.',
    lead: 'AI builds fast. Users judge in seconds.',
    body: 'FixFlags checks what the builder never experiences as a first-time visitor.',
    checks: [
      'First impressions',
      'Mobile usability',
      'Sharing previews',
      'Accessibility',
      'Trust',
      'Conversion friction',
    ] as const,
  },
  editorIntegrations: {
    headline: 'Cursor, Lovable, Bolt, Replit, and more.',
    body: 'Each Flag includes a prompt shaped for the editor you already use. Copy it, paste it, fix the issue, then re-check.',
  },
  productEvidence: {
    headline: 'What a review actually catches',
    subhead:
      'Real Flags from the product, not quote cards.',
    items: [
      {
        id: 'message',
        title: 'Message',
        lead: 'Visitors should know what you do and why it matters in five seconds.',
        findings: [
          'Hero that never names the outcome',
          'CTA that stays vague',
          'Copy that names the category, not the win',
        ],
      },
      {
        id: 'experience',
        title: 'Experience',
        lead: 'On mobile, the next step should be obvious without hunting.',
        findings: [
          'Main action buried after a long scroll on phone',
          'Tap targets too small to hit cleanly',
          'Layout that hides the next step',
        ],
      },
      {
        id: 'reach',
        title: 'Reach',
        lead: 'When someone shares your link, the card should still look like you.',
        findings: [
          'Link cards that render blank when shared',
          'Missing metadata search cannot use',
          'Sharing cards that drop your brand',
        ],
      },
    ] as const,
    cta: 'See a sample review',
    ctaHref: '/#sample-review',
  },
  /** @deprecated Prefer reportExamples / sample explorer. Kept for AGENTS social-proof disclaimer invariant. */
  testimonials: {
    headline: 'What a review actually catches',
    subhead: 'Real Flags from the product, not quote cards.',
    disclaimer: 'Illustrative findings only. Not attributed customer testimonials.',
    cardLabel: 'Example finding',
    quotes: [] as ReadonlyArray<{
      id: string
      quote: string
      role: string
      context: string
    }>,
  },
  sampleReport: {
    label: '',
    headline: 'A review you can paste into your editor.',
    body: 'Each Flag has evidence, impact, and a fix prompt.',
    previewEyebrow: 'Fix list',
    previewTitle: 'Every fix, ranked and ready',
    previewBadge: 'Screenshot evidence included',
    cta: 'View full sample review',
    ctaWithCount: (flagCount: number) => {
      void flagCount
      return 'View full sample review'
    },
    illustrativeLabel: '',
  },
  footer: {
    tagline:
      'Reviews for AI-built and live sites. Flags with evidence, and fix prompts you can paste.',
    madeWith: 'Built for people shipping with AI.',
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
  lovableBolt: {
    heroTitle: 'Paste this into Lovable or Bolt',
    heroBody: 'One click copies a fix prompt tuned for your builder. Ship the change, then re-check here.',
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
    body: 'Five concrete checks from your report evidence. Fix any failed gates before you ship.',
  },
  recheckHint: {
    title: 'Next: prove your fixes worked',
    bodyPrefix: 'Paste the fix prompts into your editor, ship the changes, then select',
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
    title: 'PageSpeed incomplete',
    body: 'PageSpeed data was unavailable for this run. Experience flags that need it may be thinner.',
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
  legacy:
    'Technology signals were not captured for this audit. Run a re-check to create a verified profile.',
  unavailable:
    'Technology signals were unavailable for this scan. The rest of the report is unaffected.',
  empty: 'No technologies could be verified from the site’s public signals.',
  partial:
    'Partial profile. Only signals preserved by the historical capture are shown.',
  changed: 'Changed since the last re-check',
  added: 'Added',
  removed: 'Removed',
  evidenceChanged: 'Evidence changed',
  disclaimer:
    'FixFlags reads public page signals. The report score reflects the site outcome, not the quality of any individual tool.',
  insightWithRubric: (
    stack: string,
    rubric: string,
    score: number,
    flagCount: number
  ) =>
    `On this ${stack} site, ${rubric} is the lowest-scoring rubric at ${score} with ${flagCount} unresolved ${flagCount === 1 ? 'Flag' : 'Flags'}.`,
  insightWithScore: (stack: string, score: number) =>
    `This ${stack} site scored ${score}. The score reflects the site outcome, not the tools themselves.`,
  insightCount: (count: number) =>
    `FixFlags verified ${count} public ${count === 1 ? 'technology' : 'technologies'} on this site.`,
  publicProfileLabel: 'Public technology profile',
  publicProfileLead:
    'Public page signals, checked by the same capture that produced this site’s FixFlags report.',
  latestPublicReport: 'Latest public report',
  completed: 'Completed',
  openPublicReport: 'Open the public report',
  relatedProfiles: 'Related public profiles',
  ownSitePrompt: 'Check your own site’s stack, score, evidence, and fix list.',
  checkAgain: 'Check this site again',
  metaTitle: (hostname: string, technologies: string[]) =>
    `${hostname} is made with ${technologies.slice(0, 3).join(', ')} | FixFlags`,
  metaDescription: (hostname: string) =>
    `Verified public technology signals for ${hostname}, connected to its latest FixFlags score and unresolved Flags.`,
  reportSummary: (score: number | null, flagCount: number) =>
    score === null
      ? `${flagCount} unresolved ${flagCount === 1 ? 'Flag' : 'Flags'}`
      : `Score ${score} · ${flagCount} ${flagCount === 1 ? 'Flag' : 'Flags'}`,
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
  description:
    'Get a blunt quality check across Message, Experience, and Reach. Paste a URL, get a grade, then fix what matters.',
  ogDescription: 'Paste your URL. Get roasted. Fix what matters.',
} as const

export const FIRST_AUDIT_PROMPT = {
  headline: 'Paste the URL you are about to share.',
  body: 'FixFlags reviews your page before anyone else sees it. You get Flags across Message, Experience, and Reach with evidence. Create a free account for fix prompts you can paste into Cursor, Claude, Lovable, or Bolt.',
  examplesLabel: 'Common first checks',
  examples: [
    { label: 'Your Product Hunt page', hint: 'producthunt.com/posts/your-product' },
    { label: 'Your demo day landing page', hint: 'yourstartup.com' },
    { label: 'A client site before handoff', hint: 'clientsite.com' },
  ],
  footerPrefix: 'Not sure what to check first?',
  footerLink: 'See a sample report',
  footerSuffix: 'to know what you will get.',
} as const
