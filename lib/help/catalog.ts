import type { HelpArticle, HelpCategory } from './types'

const ALL_HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Enter a URL, open your Site board, and keep watching.',
    icon: 'rocket',
  },
  {
    id: 'checks-and-reports',
    title: 'Flags and proof',
    description: 'Evidence, Verify, and what healthy actually means.',
    icon: 'flag',
  },
  {
    id: 'billing-and-plans',
    title: 'Billing and plans',
    description: 'Free monitors one website every 24 hours. Paid is hourly, billed per website.',
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
    title: 'Check a website URL',
    excerpt: 'Enter a public URL. FixFlags opens a Site board with Flags, coverage, and the next fix.',
    popular: true,
    searchTokens: ['scan', 'audit', 'start', 'url', 'anonymous', 'install', 'shopify', 'site'],
    body: [
      {
        type: 'p',
        text: 'Enter a public website URL on the homepage or /new. FixFlags opens a Site board for that website. You do not install an app to start. Shopify is a later connection if you sell on Shopify.',
      },
      {
        type: 'p',
        text: 'Cards stay unknown until that area has evidence. Zero Flags is not the same as healthy.',
      },
      {
        type: 'ol',
        items: [
          'Enter your website URL and start the check.',
          'Stay on the Site board while cards fill in.',
          'Open a Flag, copy the fix, then Verify the same page and action.',
        ],
      },
    ],
    related: ['reading-your-report', 'public-urls-only', 'flag-fix-recheck'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-09-08',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'reading-your-report',
    categoryId: 'getting-started',
    title: 'How to read your Site',
    excerpt: 'Coverage, Flags, and why empty is not the same as healthy.',
    popular: true,
    searchTokens: ['report', 'site', 'coverage', 'flags', 'healthy', 'unknown', 'board'],
    body: [
      {
        type: 'p',
        text: 'The Site board is the same website over time. Each card is an area we tried to check. Unknown means we have not evidenced that area yet. Zero Flags is not healthy when cards are still unknown.',
      },
      {
        type: 'p',
        text: 'Open a Flag to see what happened, where, and what should happen next. Shopify can add store context later. It is a connection, not a second product.',
      },
      {
        type: 'ul',
        items: [
          'Looking good: required areas were checked and no Flags need attention.',
          'Needs attention: a Flag has evidence and a next step.',
          'Coverage incomplete: the scan finished, but some starter areas were never evidenced.',
        ],
      },
    ],
    related: ['scores-and-severity', 'flag-fix-recheck', 'first-check'],
    relatedDocs: ['reports'],
    updatedAt: '2026-09-08',
    estimatedReadMinutes: 4,
  },
  {
    slug: 'flag-fix-recheck',
    categoryId: 'getting-started',
    title: 'Verify a Flag',
    excerpt: 'After you fix the page, check the same behavior again.',
    popular: true,
    searchTokens: ['verify', 'fix', 'flag', 'recheck', 'loop'],
    body: [
      {
        type: 'p',
        text: 'The loop is Find, Understand, Fix, Verify. Copy the fix into your editor, publish, then Verify. Verify is a fresh look at the same page and action, not a disappearing Flag.',
      },
      {
        type: 'p',
        text: 'A Flag stays open if the page is gone, blocked, skipped, or incomparable. Absence after a comparable scan is not enough. FixFlags has to see the success state.',
      },
      {
        type: 'callout',
        text: 'Keep watching is weekly on Free. Pause takes the Site off the schedule. You are covered only after a schedule is written.',
      },
    ],
    related: ['update-review-credits', 'reading-your-report', 'what-counts-as-a-check'],
    relatedDocs: ['getting-started'],
    updatedAt: '2026-09-08',
    estimatedReadMinutes: 3,
  },
  {
    slug: 'anonymous-report-access',
    categoryId: 'getting-started',
    title: 'What you see after install',
    excerpt: 'The embedded app is the product. No extra FixFlags account is required to watch the first walk.',
    searchTokens: ['anonymous', 'signed out', 'teaser', 'claim', 'gate', 'install'],
    body: [
      {
        type: 'p',
        text: 'After a successful Shopify install you land in the embedded app. The first walk starts on its own. You can watch health, video, and the named step there.',
      },
      {
        type: 'p',
        text: 'There is no website form to claim. Pro extras use the waitlist inside the app.',
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
    title: 'Save this Site to your account',
    excerpt: 'Sign in after a URL check so Flags, Verify, and Keep watching stay on the same Site.',
    searchTokens: ['claim', 'attach', 'post-login', 'save report', 'install', 'site'],
    body: [
      {
        type: 'p',
        text: 'After an anonymous check, create a free account. FixFlags attaches the Site board to you. Shopify install is a separate connection at /install.',
      },
      {
        type: 'steps',
        items: [
          'Finish the first URL check on the Site board.',
          'Sign up or sign in when asked to keep watching or verify.',
          'Return to /sites for the same website, not a new report.',
        ],
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
    title: 'Who can see the walk',
    excerpt: 'Verification stays in the Shopify app for the installed store.',
    searchTokens: ['share', 'link', 'copy link', 'public'],
    body: [
      {
        type: 'p',
        text: 'Video and screenshots belong to the installed store. Staff who can open the app in Shopify admin can watch them.',
      },
      {
        type: 'p',
        text: 'We do not publish public report links for purchase-path walks. Alert email includes a proof URL for the merchant.',
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
    title: 'Path health',
    excerpt: 'Can buy, Can\'t buy, and Unclear. We do not score the store.',
    searchTokens: ['score', 'critical', 'important', 'polish', 'grade', 'green', 'red'],
    body: [
      {
        type: 'p',
        text: 'Health is a fact about the purchase path, not a design score. We never invent conversion percentages.',
      },
      {
        type: 'p',
        text: 'Can\'t buy is confirmed twice before we email you. Unclear stays in the app. Improve items are not health and never go in alerts.',
      },
      {
        type: 'h2',
        text: 'The three states',
      },
      {
        type: 'ul',
        items: [
          'Can buy: checkout was reached. We stopped before payment.',
          'Can\'t buy: the named step failed on two independent walks.',
          'Unclear: we could not prove the path. We do not guess.',
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
    title: 'Why a walk is Unclear or failed',
    excerpt: 'Bot walls, passwords, timeouts, and what to try next.',
    popular: true,
    searchTokens: ['failed', 'error', 'timeout', 'unreachable', 'blocked', 'retry'],
    body: [
      {
        type: 'p',
        text: 'A walk can finish Unclear when a bot check, password gate, missing buy button, or timeout stops us from proving checkout. That stays in the app. We do not email Unclear.',
      },
      {
        type: 'h2',
        text: 'Common causes',
      },
      {
        type: 'ul',
        items: [
          'The storefront is password gated.',
          'A bot wall blocked the walk.',
          'No add to cart or buy control was found.',
          'The walk timed out before checkout.',
        ],
      },
      {
        type: 'p',
        text: 'If video is missing, step screenshots still appear when we captured them. Recheck after you remove the block, or email hello@fixflags.com with the shop domain.',
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
    title: 'Storefront access',
    excerpt: 'We walk the public storefront a customer uses. Password gates stay Unclear.',
    searchTokens: ['localhost', 'staging', 'password', 'vpn', 'private', 'preview', 'basic auth'],
    body: [
      {
        type: 'p',
        text: 'FixFlags walks the public product page Shopify gives us. A password-gated storefront is Unclear until the password is off that storefront.',
      },
      {
        type: 'p',
        text: 'We do not log in as a customer, complete payment, or walk a store that has no buyable product with a storefront URL.',
      },
      {
        type: 'p',
        text: 'If no buyable product exists yet, Overview says so. Publish an active product and we will walk it.',
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
        text: 'The webhook enqueues a Site check and returns the Site board URL. For manual checks, run fixflags check with --wait from a Railway release command or shell script.',
      },
    ],
    related: ['public-urls-only', 'mcp-setup', 'first-check'],
  },
  {
    slug: 'vs-lighthouse',
    categoryId: 'checks-and-reports',
    title: 'Walk vs uptime',
    excerpt: 'Store up is not the same as can buy. Uptime misses a dead add to cart.',
    searchTokens: ['lighthouse', 'pagespeed', 'difference', 'uptime'],
    body: [
      {
        type: 'p',
        text: 'An HTTP uptime check can return 200 while add to cart does nothing. FixFlags walks the path a customer uses to buy and shows you the video if that path is down.',
      },
      {
        type: 'p',
        text: 'This is not session replay of real shoppers, not a Lighthouse wrapper, and not an ads attribution suite.',
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
    title: 'Protect vs Improve',
    excerpt: 'The alarm is the buy path. Improve is a short secondary list.',
    searchTokens: ['finish plan', 'fix list', 'priority', 'top three', 'improve'],
    body: [
      {
        type: 'p',
        text: 'Protect is whether customers can still buy. Prove is the video of our walk. Understand is the named step. Improve is optional and never goes in Slack or email.',
      },
      {
        type: 'p',
        text: 'Do not treat Improve as the reason to install. Install to know the purchase path still works.',
      },
      {
        type: 'link',
        text: 'Read the purchase path guide',
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
    title: 'Watch verification',
    excerpt: 'Video of our walk, GIF fallback, and step screenshots.',
    searchTokens: ['screenshot', 'evidence', 'mobile', 'desktop', 'capture', 'video', 'gif'],
    body: [
      {
        type: 'p',
        text: 'Each walk keeps video of the FixFlags session when encoding works. If video is missing, we keep a GIF of the key steps when we can, plus screenshots of product, cart, and checkout or the failed step.',
      },
      {
        type: 'p',
        text: 'This is our walk, not a recording of your shoppers. We stop before payment.',
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
    title: 'Walk still in progress',
    excerpt: 'What to do when the first walk takes longer than expected.',
    searchTokens: ['running', 'stuck', 'loading', 'timeout', 'queued', 'walking'],
    body: [
      {
        type: 'p',
        text: 'The first walk usually finishes in a few minutes. Overview says Walking the path to checkout until the first result lands.',
      },
      {
        type: 'ul',
        items: [
          'Leave the app open. It refreshes while a walk is in progress.',
          'If the storefront is password gated, the result will be Unclear.',
          'If nothing appears after a long wait, Recheck or email hello@fixflags.com.',
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
    excerpt: 'One website free, every 24 hours. Paid is $49 per website, up to every hour. We are not charging yet.',
    popular: true,
    searchTokens: ['pricing', 'upgrade', 'studio', 'plan', 'monitoring'],
    body: [
      {
        type: 'p',
        text: 'Free: one website, 24/7 monitoring checked every 24 hours, Flags with evidence, a next step to fix, verify after you publish, and connections included.',
      },
      {
        type: 'p',
        text: 'Pro: $49 per website per month, checked up to every hour. Same Flags, evidence, verify, and connections.',
      },
      {
        type: 'p',
        text: 'Studio is hourly monitoring for several websites, billed per website, quoted on a demo. We are not charging yet.',
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
    title: 'Request a demo',
    excerpt: 'Paid monitoring is billed per website. Request a demo. We are not charging yet.',
    searchTokens: ['upgrade', 'downgrade', 'change plan', 'switch', 'waitlist', 'demo'],
    body: [
      {
        type: 'p',
        text: 'Open Pricing and request a demo for Pro or Studio. We email you to set a time. We are not charging yet.',
      },
      {
        type: 'p',
        text: 'Free keeps monitoring one website every 24 hours while you wait.',
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
    excerpt: 'There is no charge on the Shopify app today.',
    searchTokens: ['invoice', 'receipt', 'billing history', 'download'],
    body: [
      {
        type: 'p',
        text: 'FixFlags is free to install. We are not charging yet, so there are no invoices for the Shopify app.',
      },
      {
        type: 'p',
        text: 'If a paid plan opens later, receipts will go to the email on the store.',
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
    title: 'When the recheck cap is hit',
    excerpt: 'Free stores get five manual rechecks per day. Scheduled walks continue.',
    searchTokens: ['limit', 'quota', 'run out', 'no reviews left', 'recheck'],
    body: [
      {
        type: 'p',
        text: 'If Recheck says the daily limit was reached, wait for the next scheduled walk or try again tomorrow. Monitoring stays on.',
      },
      {
        type: 'p',
        text: 'Join the Pro waitlist if you need a faster cadence or extra paths.',
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
    title: 'What the free plan includes',
    excerpt: 'One website, 24/7 monitoring every 24 hours, Flags, evidence, and verify.',
    searchTokens: ['quota', 'limit', 'credit', 'usage', 'scan', 'monitoring'],
    body: [
      {
        type: 'p',
        text: 'Free includes one website with 24/7 monitoring checked every 24 hours, Flags with evidence, a next step to fix, verify after you publish, and connections.',
      },
      {
        type: 'p',
        text: 'A check that cannot start does not change that cadence. Request a demo for hourly monitoring on more websites.',
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
    title: 'How Recheck works',
    excerpt: 'Recheck is a fresh walk of the same purchase path. Five per day on Free.',
    searchTokens: ['update review', 'recheck', 'quota', 'credit'],
    body: [
      {
        type: 'p',
        text: 'Recheck runs a fresh mobile walk of the same path. It is how you confirm a theme or app fix after a Can\'t buy result.',
      },
      {
        type: 'callout',
        text: 'If the daily cap is hit, scheduled walks still run. Recheck becomes available again the next day.',
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
    excerpt: 'Credit packs are not part of the Shopify app. We are not charging yet.',
    searchTokens: ['credit pack', 'buy credits', 'overflow'],
    body: [
      {
        type: 'p',
        text: 'Credit packs are not sold for the Shopify purchase-path app. Existing leftover credits from older billing, if any, stay unused here.',
      },
      {
        type: 'p',
        text: 'The Shopify app is free to install. Pro extras are waitlisted.',
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
    title: 'Uninstall the app',
    excerpt: 'Uninstall from Shopify admin. Walks stop. A redact request deletes stored shop data.',
    searchTokens: ['cancel', 'subscription', 'portal', 'invoice', 'receipt', 'uninstall'],
    body: [
      {
        type: 'p',
        text: 'Uninstall FixFlags from Shopify admin. That stops scheduled walks and pulses. Verification artifacts are removed when the shop is redacted.',
      },
      {
        type: 'p',
        text: 'There is no Stripe subscription on the Shopify app today.',
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
    excerpt: 'The Shopify app is not charging, so there is no past-due card state.',
    searchTokens: ['past due', 'failed payment', 'card declined'],
    body: [
      {
        type: 'p',
        text: 'The Shopify app is free to install. There is no card on file and no past-due state for this product.',
      },
      {
        type: 'p',
        text: 'If something looks wrong on a waitlist or alert email, write to hello@fixflags.com.',
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
    excerpt: 'The Shopify app uses your Shopify admin session. We do not keep a separate password.',
    searchTokens: ['login', 'password', '2fa', 'passkey', 'oauth', 'shopify'],
    body: [
      {
        type: 'p',
        text: 'Open FixFlags from Shopify admin. The embedded app authenticates with an App Bridge session token. There is no separate FixFlags password for the store app.',
      },
      {
        type: 'p',
        text: 'Staff access follows who can open apps in that Shopify store.',
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
    title: 'Alerts and proof',
    excerpt: 'Email and optional Slack on confirmed Can\'t buy and recovery. Unclear stays in the app.',
    searchTokens: ['private', 'share', 'public', 'anonymous', 'alert', 'slack'],
    body: [
      {
        type: 'p',
        text: 'Email goes to the store owner when a path is confirmed broken, and again when it can take orders. Optional Slack uses an incoming webhook you paste in Settings.',
      },
      {
        type: 'p',
        text: 'The message includes a proof URL. Improve items never go in alerts. Unclear stays in the app.',
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
          'Include the shop domain when asking about a specific walk.',
        ],
      },
      {
        type: 'p',
        text: 'We do not offer phone support. Email hello@fixflags.com for privacy or uninstall questions.',
      },
    ],
    related: ['why-check-failed', 'payment-past-due', 'free-vs-pro'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'delete-account',
    categoryId: 'account',
    title: 'Uninstall and shop data',
    excerpt: 'Uninstall stops walks. A shop redact request deletes stored shop artifacts.',
    searchTokens: ['delete', 'remove account', 'close account', 'gdpr', 'uninstall'],
    body: [
      {
        type: 'p',
        text: 'Uninstall FixFlags from Shopify admin to stop walks. Shopify also sends shop/redact, which deletes the stored shop record and verification artifacts.',
      },
      {
        type: 'p',
        text: 'Customer personal data is not stored at launch. For privacy questions, email hello@fixflags.com.',
      },
    ],
    related: ['contact-us', 'report-privacy'],
    updatedAt: '2026-08-26',
    estimatedReadMinutes: 2,
  },
  {
    slug: 'change-email',
    categoryId: 'account',
    title: 'Change alert email',
    excerpt: 'Alerts go to the store owner email Shopify gives us at install.',
    searchTokens: ['email', 'change email', 'update email'],
    body: [
      {
        type: 'p',
        text: 'Integrity alerts use the store owner email from Shopify. Update that email in Shopify admin if you need alerts somewhere else.',
      },
      {
        type: 'p',
        text: 'Optional Slack is a separate incoming webhook in FixFlags Settings.',
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
    title: 'Install or session issues',
    excerpt: 'Retry install from /install, or reopen the app from Shopify admin.',
    searchTokens: ['oauth', 'google', 'github', 'sign in failed', 'wrong account', 'install'],
    body: [
      {
        type: 'p',
        text: 'If install does not finish, open /install, enter the shop domain, and approve the app again.',
      },
      {
        type: 'ul',
        items: [
          'Reopen FixFlags from Shopify admin if the embedded session expired.',
          'Confirm the shop domain looks like your-store.myshopify.com.',
          'Email hello@fixflags.com with the shop domain if the error repeats.',
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
