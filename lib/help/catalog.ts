import type { HelpArticle, HelpCategory } from './types'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'

const ALL_HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Run your first product review and read the report.',
    icon: 'rocket',
  },
  {
    id: 'checks-and-reports',
    title: 'Checks and reports',
    description: 'Scores, severity, failures, and what we can reach.',
    icon: 'flag',
  },
  {
    id: 'billing-and-plans',
    title: 'Billing and plans',
    description: 'Free vs Pro, credits, update reviews, and payments.',
    icon: 'creditCard',
  },
  {
    id: 'mcp-and-editors',
    title: 'MCP and editors',
    description: 'Cursor, Claude Code, API keys, and paste workflows.',
    icon: 'terminal',
  },
  {
    id: 'account',
    title: 'Account',
    description: 'Sign-in, privacy, and how to reach us.',
    icon: 'user',
  },
] as const

const ALL_HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'first-check',
    categoryId: 'getting-started',
    title: 'Run your first product review',
    excerpt: 'Paste a public URL. Get Flags across Message, Experience, and Reach.',
    popular: true,
    searchTokens: ['scan', 'audit', 'start', 'url', 'anonymous'],
    body: [
      {
        type: 'p',
        text: 'Paste any publicly accessible URL on the homepage or dashboard. FixFlags captures screenshots, checks the product, and builds a ranked Fix list with evidence.',
      },
      {
        type: 'p',
        text: `Your report opens immediately while the product review runs. If you are signed out, inspect the evidence, then create an account or sign in to save it and unlock the complete report. A free account includes ${PRICING_COPY.freeProductReviewsPerMonth} product reviews per month. New URLs, update reviews, and completed Watch reviews share the allowance.`,
      },
      {
        type: 'ol',
        items: [
          'Paste your live URL (or a public preview URL).',
          'Create an account or sign in on the report. Desktop and mobile captures appear independently as the check runs.',
          'Open the Fix list. Select any Flag to inspect its screenshot, evidence, and available fix prompt.',
        ],
      },
      {
        type: 'image',
        src: '/samples/demo-original-desktop.webp',
        alt: 'FixFlags report with ranked Fix list and evidence panel',
      },
    ],
    related: ['reading-your-report', 'public-urls-only', 'flag-fix-recheck'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'reading-your-report',
    categoryId: 'getting-started',
    title: 'How to read your report',
    excerpt: 'Three rubrics, severity, evidence, and fix prompts.',
    popular: true,
    searchTokens: ['report', 'rubric', 'message', 'experience', 'reach'],
    body: [
      {
        type: 'p',
        text: 'Every report groups Flags into three sections. Message covers copy and positioning. Experience covers layout, usability, and performance. Reach covers SEO metadata and link previews.',
      },
      {
        type: 'p',
        text: 'The Fix list contains every unresolved Flag, ranked by launch impact. Select a Flag to inspect its evidence, screenshot, and editor-ready prompt. Contract, memory, and launch gates live on the signed-in Product page.',
      },
      {
        type: 'ul',
        items: [
          'Start at the top of the Fix list and copy one fix into your editor.',
          'Filter the complete list by rubric, severity, impact, or page.',
          'Copy one Flag or use Copy all for a plan-mode prompt.',
        ],
      },
      {
        type: 'image',
        src: '/samples/demo-original-mobile.webp',
        alt: 'FixFlags mobile report view with Fix list and evidence',
      },
    ],
    related: ['scores-and-severity', 'flag-fix-recheck', 'first-check'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 4,
  },
  {
    slug: 'flag-fix-recheck',
    categoryId: 'getting-started',
    title: 'Flag, fix, and update review',
    excerpt: 'The core loop. Update reviews use product review credits.',
    popular: true,
    searchTokens: ['recheck', 'update review', 'fix prompt', 'loop'],
    body: [
      {
        type: 'p',
        text: 'FixFlags is built around one loop: Flag → Fix → update review. Copy a fix prompt into your editor, apply the change, then update review the same report.',
      },
      {
        type: 'p',
        text: 'Update reviews use product review credits on every plan. They count toward the same monthly product review allowance.',
      },
      {
        type: 'callout',
        text: 'Before/after comparison is included on every plan so you can prove what cleared and what is still open.',
      },
    ],
    related: ['update-review-credits', 'reading-your-report', 'what-counts-as-a-check'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'anonymous-report-access',
    categoryId: 'getting-started',
    title: 'Anonymous vs signed-in report access',
    excerpt: 'What you can see before sign-in and what unlocks after you claim the report.',
    searchTokens: ['anonymous', 'signed out', 'teaser', 'claim', 'gate'],
    body: [
      {
        type: 'p',
        text: 'Your report opens immediately while the product review runs. You can inspect real evidence, scores, and Flags before you create an account.',
      },
      {
        type: 'p',
        text: 'Fix prompts, Agent chat, update reviews, and account history unlock after you sign in and claim the report to your account.',
      },
      {
        type: 'link',
        text: 'Read the getting started guide',
        href: '/docs/getting-started',
      },
    ],
    related: ['claiming-a-report', 'first-check', 'report-privacy'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'claiming-a-report',
    categoryId: 'getting-started',
    title: 'Claim your report after sign-in',
    excerpt: 'Save an anonymous report to your account without losing evidence or progress.',
    searchTokens: ['claim', 'attach', 'post-login', 'save report'],
    body: [
      {
        type: 'p',
        text: 'After sign-in you land on post-login so a running check can finish claiming before navigation. The report attaches to your account automatically when you return.',
      },
      {
        type: 'steps',
        items: [
          'Run a product review while signed out.',
          'Create an account or sign in from the report.',
          'Return to the same report URL. Fix prompts and owner tools unlock.',
        ],
      },
      {
        type: 'image',
        src: '/samples/stripe-desktop.webp',
        alt: 'FixFlags report after sign-in with fix prompts unlocked',
      },
    ],
    related: ['anonymous-report-access', 'sign-in-and-security', 'first-check'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'sharing-a-report',
    categoryId: 'getting-started',
    title: 'Share a report link',
    excerpt: 'Copy the canonical report URL to share evidence with teammates or stakeholders.',
    searchTokens: ['share', 'link', 'copy link', 'public'],
    body: [
      {
        type: 'p',
        text: 'Every report has one canonical URL. Anyone with the link can inspect public-safe evidence, scores, and Flags.',
      },
      {
        type: 'p',
        text: 'Fix prompts, Agent chat, and update reviews stay available only to the report owner. Use Export → Copy link from a report you own.',
      },
    ],
    related: ['report-privacy', 'reading-your-report'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'scores-and-severity',
    categoryId: 'checks-and-reports',
    title: 'Scores and severity',
    excerpt: 'How the overall score is calculated and what Critical, Important, and Polish mean.',
    searchTokens: ['score', 'critical', 'important', 'polish', 'grade'],
    body: [
      {
        type: 'p',
        text: 'The score starts at 100 and drops based on the number and severity of unresolved Flags across Message, Experience, and Reach.',
      },
      {
        type: 'p',
        text: 'Critical Flags subtract more than Important Flags, which subtract more than Polish Flags. The compact Review header shows the Score and links to complete earlier Reviews. Critical Flags lead the ranked Fix list, where filters open the matching evidence and fix detail. The overall score weights Experience highest, then Message, then Reach. Experience may also include PageSpeed when available.',
      },
      {
        type: 'h2',
        text: 'Severity meanings',
      },
      {
        type: 'ul',
        items: [
          'Critical: Prevents a core user outcome (blocking).',
          'Important: Materially harms conversion, access, or acquisition.',
          'Polish: Meaningful improvement or best practice.',
        ],
      },
    ],
    related: ['reading-your-report', 'vs-lighthouse'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'why-check-failed',
    categoryId: 'checks-and-reports',
    title: 'Why a product review failed',
    excerpt: 'Unreachable pages, blocked bots, timeouts, and what to try next.',
    popular: true,
    searchTokens: ['failed', 'error', 'timeout', 'unreachable', 'blocked', 'retry'],
    body: [
      {
        type: 'p',
        text: 'A check can fail when the URL is unreachable, blocks automated visits, returns a non-HTML response, or takes longer than our timeout. Retry after confirming the page loads in a normal browser.',
      },
      {
        type: 'h2',
        text: 'Common causes',
      },
      {
        type: 'ul',
        items: [
          'The URL requires a login or VPN (we only check public URLs).',
          'The site is rate-limiting or blocking bots.',
          'Temporary scanner or network issues on our side. Wait a few minutes and retry.',
          'The link does not return a normal HTML page.',
        ],
      },
      {
        type: 'p',
        text: 'If automated checks finish but AI summary is missing, deterministic Flags and screenshots still appear. You can retry or ask us in chat with the report link.',
      },
    ],
    related: ['public-urls-only', 'contact-us', 'first-check'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'public-urls-only',
    categoryId: 'checks-and-reports',
    title: 'Public URLs only',
    excerpt: 'FixFlags reviews public HTTPS URLs on every plan.',
    searchTokens: ['localhost', 'staging', 'password', 'vpn', 'private', 'preview', 'basic auth'],
    body: [
      {
        type: 'p',
        text: 'FixFlags checks publicly reachable HTTPS URLs. Localhost and private networks are not supported.',
      },
      {
        type: 'p',
        text: 'Use a publicly reachable HTTPS preview URL from your host when production is not ready.',
      },
      {
        type: 'p',
        text: 'Password-only, localhost, and private-network pages are not part of the public URL review experience.',
      },
    ],
    related: ['why-check-failed', 'first-check'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'railway-deploy-check',
    categoryId: 'mcp-and-editors',
    title: 'Railway deploy review',
    excerpt: 'Enqueue a Live Review after each Railway deployment succeeds.',
    searchTokens: ['railway', 'deploy', 'webhook', 'ci', 'preview', 'release'],
    body: [
      {
        type: 'p',
        text: 'FixFlags can enqueue a Live Review when your Railway service deploys successfully. This is the supported post-deploy review when you host on Railway (no GitHub Action or Vercel webhook required).',
      },
      {
        type: 'ol',
        items: [
          'Create a FixFlags API key from Settings → API keys (Pro or Studio).',
          'Optional: set RAILWAY_WEBHOOK_SECRET on your FixFlags deployment and append webhookSecret to the webhook URL.',
          'In Railway → Project → Settings → Webhooks, point a successful-deploy event to your FixFlags host with apiKey and url query parameters.',
          'Use your service public HTTPS domain for url. Railway webhooks do not always include the public URL in the payload.',
        ],
      },
      {
        type: 'p',
        text: 'The webhook enqueues a non-blocking critical-path check and returns reportId and reportUrl. For manual checks, run fixflags check with --wait from a Railway release command or shell script.',
      },
    ],
    related: ['public-urls-only', 'mcp-setup', 'first-check'],
  },
  {
    slug: 'vs-lighthouse',
    categoryId: 'checks-and-reports',
    title: 'FixFlags vs Lighthouse',
    excerpt: 'Lighthouse scores performance and a11y. FixFlags adds message, experience, and reach review with fix prompts.',
    searchTokens: ['lighthouse', 'pagespeed', 'difference'],
    body: [
      {
        type: 'p',
        text: 'Lighthouse scores performance, accessibility, and SEO. FixFlags adds an AI reviewer that reads your screenshots for message, experience, and reach gaps, including trust and credibility signals.',
      },
      {
        type: 'p',
        text: 'Every Flag includes evidence and a fix prompt. Results are grouped into Message, Experience, and Reach. We may use PageSpeed data inside Experience when it is available, but FixFlags is not a Lighthouse replacement.',
      },
    ],
    related: ['scores-and-severity', 'reading-your-report'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'finish-plan-vs-fix-list',
    categoryId: 'checks-and-reports',
    title: 'Finish Plan vs full Fix list',
    excerpt: 'The Fix list holds every unresolved Flag. The Finish Plan focuses your next one-to-three moves.',
    searchTokens: ['finish plan', 'fix list', 'priority', 'top three'],
    body: [
      {
        type: 'p',
        text: 'The Fix list ranks every unresolved Flag by launch impact. Open any Flag to inspect evidence, screenshots, and fix prompts.',
      },
      {
        type: 'p',
        text: 'The Finish Plan is the focused next move: typically one to three highest-impact Flags to fix before your update review.',
      },
      {
        type: 'link',
        text: 'Read about report structure in Docs',
        href: '/docs/reports',
      },
    ],
    related: ['reading-your-report', 'scores-and-severity'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'evidence-and-screenshots',
    categoryId: 'checks-and-reports',
    title: 'Evidence and screenshots',
    excerpt: 'How FixFlags captures desktop and mobile evidence and attaches it to each Flag.',
    searchTokens: ['screenshot', 'evidence', 'mobile', 'desktop', 'capture'],
    body: [
      {
        type: 'p',
        text: 'Each Flag links to screenshot evidence matched to the finding. Desktop and mobile captures appear independently as the review completes.',
      },
      {
        type: 'p',
        text: 'Evidence anchors point to the exact copy, element, or metadata the check flagged. Use them to confirm the issue before copying a fix prompt.',
      },
      {
        type: 'image',
        src: '/samples/demo-original-desktop.webp',
        alt: 'Sample FixFlags report screenshot showing ranked Flags and evidence',
      },
    ],
    related: ['reading-your-report', 'why-check-failed'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'stuck-running-review',
    categoryId: 'checks-and-reports',
    title: 'Review stuck on Running',
    excerpt: 'What to do when a product review takes longer than expected or never completes.',
    searchTokens: ['running', 'stuck', 'loading', 'timeout', 'queued'],
    body: [
      {
        type: 'p',
        text: 'Most product reviews finish within a few minutes. A long-running review may still be capturing pages, running checks, or waiting in the queue.',
      },
      {
        type: 'ul',
        items: [
          'Refresh the report page after a few minutes. Progress and partial Flags may already be visible.',
          'Confirm the URL loads in a normal browser without login.',
          'If the review fails, open the failure message for the specific cause.',
        ],
      },
      {
        type: 'link',
        text: 'See troubleshooting in Docs',
        href: '/docs/troubleshooting',
      },
    ],
    related: ['why-check-failed', 'contact-us'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'free-vs-pro',
    categoryId: 'billing-and-plans',
    title: 'Free vs Pro',
    excerpt: 'What you get on Free, Pro, and Studio.',
    popular: true,
    searchTokens: ['pricing', 'upgrade', 'studio', 'plan'],
    body: [
      {
        type: 'p',
        text: `Free: ${PRICING_COPY.freeProductReviewsPerMonth} product reviews per month for one product. Each review covers the page you paste and checks every public link.`,
      },
      {
        type: 'p',
        text: `Pro (${PRICING_COPY.proPrice}${PRICING_COPY.proPeriod}): ${PRICING_COPY.proProductReviewsPerMonth} product reviews per month across up to five products, with history across releases. Each review covers this page and every public page it links to.`,
      },
      {
        type: 'p',
        text: `Studio (${PRICING_COPY.studioPrice}${PRICING_COPY.studioPeriod}): ${PRICING_COPY.studioProductReviewsPerMonth} product reviews per month, unlimited products, scheduled reviews, and a shared workspace. Each review covers this page, its linked pages, and one level beyond. Workspace seats are unlimited for a limited time.`,
      },
      {
        type: 'p',
        text: 'Pro and Studio include logged-in review on your computer when those plans open. That is not available yet.',
      },
      {
        type: 'p',
        text: 'Every Product Review includes prioritized Flags, evidence, and fix prompts. Plans add how far a review goes, product capacity, release history, scheduled reviews, and workspace access. Usage does not roll over.',
      },
    ],
    related: ['what-counts-as-a-check', 'cancel-or-manage'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'upgrade-or-downgrade',
    categoryId: 'billing-and-plans',
    title: 'Upgrade or downgrade your plan',
    excerpt: 'Change plans from Pricing or the Stripe customer portal.',
    searchTokens: ['upgrade', 'downgrade', 'change plan', 'switch'],
    body: [
      {
        type: 'p',
        text: 'Open Pricing while signed in to upgrade. Downgrades and plan changes also run through the Stripe customer portal from Billing → Manage subscription.',
      },
      {
        type: 'p',
        text: 'When you upgrade, paid usage applies after checkout completes. When you downgrade or cancel, access continues through the current billing period.',
      },
    ],
    related: ['free-vs-pro', 'cancel-or-manage'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'invoices-and-receipts',
    categoryId: 'billing-and-plans',
    title: 'Invoices and receipts',
    excerpt: 'Download invoices from the Stripe customer portal.',
    searchTokens: ['invoice', 'receipt', 'billing history', 'download'],
    body: [
      {
        type: 'p',
        text: 'Open Billing and choose Manage subscription. The Stripe customer portal lists past invoices and lets you download PDF receipts.',
      },
      {
        type: 'p',
        text: 'Invoice emails also go to the billing email on your Stripe customer record.',
      },
    ],
    related: ['cancel-or-manage', 'payment-past-due'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'when-credits-run-out',
    categoryId: 'billing-and-plans',
    title: 'When product reviews run out',
    excerpt: 'What happens at your monthly limit and how to continue.',
    searchTokens: ['limit', 'quota', 'run out', 'no reviews left'],
    body: [
      {
        type: 'p',
        text: 'When you reach your monthly product review allowance, new reviews and update reviews pause until the next billing cycle or until you upgrade.',
      },
      {
        type: 'p',
        text: 'Failed reviews that never produce a report do not consume a credit. Existing purchased credit packs still apply if you have a balance.',
      },
    ],
    related: ['what-counts-as-a-check', 'free-vs-pro', 'upgrade-or-downgrade'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'what-counts-as-a-check',
    categoryId: 'billing-and-plans',
    title: 'What counts as a product review',
    excerpt:
      'New URLs and update reviews use product review credits. Failed runs that never produce a report do not.',
    searchTokens: ['quota', 'limit', 'credit', 'usage', 'scan'],
    body: [
      {
        type: 'p',
        text: 'A completed review counts toward your monthly allowance. This includes the first review of a product, a review after changes, and a completed scheduled review on Studio.',
      },
      {
        type: 'p',
        text: 'Failed product reviews that never produce a report do not use a credit.',
      },
    ],
    related: ['update-review-credits', 'free-vs-pro'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'update-review-credits',
    categoryId: 'billing-and-plans',
    title: 'How update reviews use credits',
    excerpt: 'Update reviews on reports you own use one product review credit each time.',
    searchTokens: ['update review', 'recheck', 'quota', 'credit'],
    body: [
      {
        type: 'p',
        text: 'An update review runs a fresh capture on the same report and compares it with the previous result. Each update review uses one product review credit on every plan.',
      },
      {
        type: 'callout',
        text: 'You must own the report (signed-in account that ran or claimed the product review). Anonymous private links cannot update review until you save the report to an account.',
      },
    ],
    related: ['flag-fix-recheck', 'what-counts-as-a-check'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'credits',
    categoryId: 'billing-and-plans',
    title: 'Credit packs',
    excerpt: 'Credit packs are no longer available for purchase. Existing credits remain active.',
    searchTokens: ['credit pack', 'buy credits', 'overflow'],
    body: [
      {
        type: 'p',
        text: 'Credit packs are no longer available for purchase. Existing credits remain active and never expire.',
      },
      {
        type: 'p',
        text: 'New product reviews still follow your plan allowance first.',
      },
    ],
    related: ['what-counts-as-a-check', 'free-vs-pro', 'payment-past-due'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'cancel-or-manage',
    categoryId: 'billing-and-plans',
    title: 'Cancel or manage billing',
    excerpt: 'Use the Stripe customer portal from Billing. Access continues through the period end.',
    searchTokens: ['cancel', 'subscription', 'portal', 'invoice', 'receipt'],
    body: [
      {
        type: 'p',
        text: 'Open Billing in the app and use Manage subscription. That opens the Stripe customer portal where you can update payment methods, download invoices, or cancel.',
      },
      {
        type: 'p',
        text: 'If you cancel, you keep access through the end of the current billing period. You can upgrade or downgrade from Pricing when you are ready.',
      },
    ],
    related: ['payment-past-due', 'free-vs-pro', 'contact-us'],
    relatedDocs: ['home'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'payment-past-due',
    categoryId: 'billing-and-plans',
    title: 'Payment past due',
    excerpt: 'Update your card in the billing portal to restore your paid usage allowance.',
    searchTokens: ['past due', 'failed payment', 'card declined'],
    body: [
      {
        type: 'p',
        text: 'If a subscription payment fails, the account returns to the Free monthly usage allowance until payment succeeds. Open Billing and update your payment method in the Stripe customer portal.',
      },
      {
        type: 'p',
        text: 'Stripe will retry the charge after you update your card. If you need help, open chat from any page or email hello@fixflags.com.',
      },
    ],
    related: ['cancel-or-manage', 'contact-us', 'credits'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'mcp-setup',
    categoryId: 'mcp-and-editors',
    title: 'Set up MCP',
    excerpt: 'Open the canonical editor guide, create a scoped API key, and test the connection.',
    popular: true,
    searchTokens: ['mcp', 'editor', 'integration', 'api key', 'connection'],
    body: [
      {
        type: 'p',
        text: 'MCP lets your editor use the FixFlags Check → Fix → update review workflow. The public documentation explains each editor. Creating a credential and testing the connection requires Pro.',
      },
      {
        type: 'p',
        text: 'Open the editor integration guide for the current setup location, placeholder-safe configuration, verification steps, and official vendor documentation.',
      },
      {
        type: 'callout',
        text: 'Credentials are revealed once. Keep them in the editor secret store and never send them through support.',
      },
    ],
    related: ['api-keys', 'lovable-bolt-paste', 'free-vs-pro'],
  },
  {
    slug: 'lovable-bolt-paste',
    categoryId: 'mcp-and-editors',
    title: 'Lovable and Bolt',
    excerpt: 'Connect through custom MCP or copy the exact builder prompt from your report.',
    searchTokens: ['lovable', 'bolt', 'v0', 'paste'],
    body: [
      {
        type: 'p',
        text: 'Lovable and Bolt support FixFlags through custom MCP connectors. Add the FixFlags HTTP endpoint and authenticate with a FixFlags API key.',
      },
      {
        type: 'p',
        text: 'FixFlags still checks any publicly accessible URL regardless of how the site was built. Fix prompts are tuned for Cursor, Claude Code, Lovable, Bolt, and Devin.',
      },
    ],
    related: ['mcp-setup', 'flag-fix-recheck'],
  },
  {
    slug: 'api-keys',
    categoryId: 'mcp-and-editors',
    title: 'API keys',
    excerpt: 'Create, rotate, and store keys safely. Keys are hashed; we cannot recover a lost key.',
    searchTokens: ['api key', 'ff_live', 'rotate', 'settings'],
    body: [
      {
        type: 'p',
        text: 'API keys are available on Pro and Studio. Create them in Settings → API Keys. Keys are stored hashed on the server; we cannot recover a lost key. Rotate and create a new one if needed.',
      },
      {
        type: 'ul',
        items: [
          'Never commit API keys to git. Use env vars or your editor secret store.',
          'Never share keys in screenshots, Slack, or client-side code.',
          'Rotate immediately if a key is exposed.',
        ],
      },
    ],
    related: ['mcp-setup', 'free-vs-pro'],
  },
  {
    slug: 'sign-in-and-security',
    categoryId: 'account',
    title: 'Sign-in and security',
    excerpt: 'Email, OAuth, password reset, and passkey two-factor.',
    searchTokens: ['login', 'password', '2fa', 'passkey', 'oauth'],
    body: [
      {
        type: 'p',
        text: 'Sign in with email or OAuth. Forgot password sends a reset link to your email. Invalid or expired links can be replaced by requesting a new one.',
      },
      {
        type: 'p',
        text: 'You can enable passkey-based two-factor authentication in Settings → Sign-in methods. Passkeys live there with 2FA. Keep backup codes somewhere safe.',
      },
      {
        type: 'p',
        text: 'After sign-in you always land on post-login so a check that is still running can be claimed before navigation. You then return to the same report.',
      },
    ],
    related: ['report-privacy', 'contact-us'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'report-privacy',
    categoryId: 'account',
    title: 'Report access',
    excerpt: 'Report evidence is public. Owner tools and account data stay gated.',
    searchTokens: ['private', 'share', 'public', 'anonymous'],
    body: [
      {
        type: 'p',
        text: 'Anyone with the canonical report URL can inspect its score, Flags, screenshots, and public-safe evidence.',
      },
      {
        type: 'p',
        text: 'Agent chat, fix prompts, Product Memory, account history, update reviews, and export remain available only to the report owner. Use Copy link in Export to share the report evidence.',
      },
    ],
    related: ['free-vs-pro', 'sign-in-and-security'],
    relatedDocs: ['reports'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'contact-us',
    categoryId: 'account',
    title: 'Contact us',
    excerpt: 'Chat is primary. Email for legal and high-volume. Typical reply within a few hours.',
    popular: true,
    searchTokens: ['support', 'help', 'email', 'chat', 'contact'],
    body: [
      {
        type: 'p',
        text: 'The fastest way to reach us is live chat (the message button on any page). We typically reply within a few hours during business hours.',
      },
      {
        type: 'ul',
        items: [
          'Chat: open the chat button, or use Open chat on any Help article.',
          'Email: hello@fixflags.com for privacy, terms, or high-volume pricing.',
          'Include your report URL when asking about a specific check.',
        ],
      },
      {
        type: 'p',
        text: 'We do not offer phone support. Product feedback on reports (thumbs up/down) also reaches the team.',
      },
    ],
    related: ['why-check-failed', 'payment-past-due', 'free-vs-pro'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'delete-account',
    categoryId: 'account',
    title: 'Delete your account',
    excerpt: 'Delete your account from Settings. A confirmation email follows.',
    searchTokens: ['delete', 'remove account', 'close account', 'gdpr'],
    body: [
      {
        type: 'p',
        text: 'To delete your FixFlags account and associated data, open Settings and choose Delete account. We send a confirmation email after deletion.',
      },
      {
        type: 'p',
        text: 'If you cannot reach Settings, open chat or email hello@fixflags.com from the address on the account. Include whether you also want report links revoked.',
      },
    ],
    related: ['contact-us', 'report-privacy'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'change-email',
    categoryId: 'account',
    title: 'Change your email address',
    excerpt: 'Update the email on your FixFlags account or billing record.',
    searchTokens: ['email', 'change email', 'update email'],
    body: [
      {
        type: 'p',
        text: 'Sign-in email changes run through your account settings when email/password auth is enabled. OAuth accounts use the provider email.',
      },
      {
        type: 'p',
        text: 'Billing receipt email may differ from sign-in email. Update payment contact details in the Stripe customer portal from Billing.',
      },
    ],
    related: ['sign-in-and-security', 'contact-us'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'oauth-sign-in-issues',
    categoryId: 'account',
    title: 'OAuth sign-in issues',
    excerpt: 'Recover when Google or GitHub sign-in fails or lands on the wrong account.',
    searchTokens: ['oauth', 'google', 'github', 'sign in failed', 'wrong account'],
    body: [
      {
        type: 'p',
        text: 'If OAuth sign-in fails, try an incognito window and confirm you are using the intended provider account.',
      },
      {
        type: 'ul',
        items: [
          'Clear cookies for fixflags.com and retry.',
          'If you previously used email sign-in, use the same email or link accounts through support.',
          'After sign-in, post-login claims any anonymous report before navigating away.',
        ],
      },
    ],
    related: ['sign-in-and-security', 'claiming-a-report'],
    relatedDocs: ['troubleshooting'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 3,
  },
] as const

export const HELP_CATEGORIES: readonly HelpCategory[] = ALL_HELP_CATEGORIES.filter(
  (category) => category.id !== 'mcp-and-editors',
)

export const HELP_ARTICLES: readonly HelpArticle[] = ALL_HELP_ARTICLES.filter(
  (article) => article.categoryId !== 'mcp-and-editors',
)
