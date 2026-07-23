import type { HelpArticle, HelpCategory } from './types'

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Run your first check and read the report.',
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
    description: 'Free vs Pro, credits, re-checks, and payments.',
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

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: 'first-check',
    categoryId: 'getting-started',
    title: 'Run your first check',
    excerpt: 'Paste a public URL. Get Flags across Message, Experience, and Reach.',
    popular: true,
    searchTokens: ['scan', 'audit', 'start', 'url', 'anonymous'],
    body: [
      {
        type: 'p',
        text: 'Paste any publicly accessible URL on the homepage or dashboard. FixFlags captures screenshots, checks the product, and builds a complete ranked Fix list with evidence.',
      },
      {
        type: 'p',
        text: 'Your first teaser does not require an account. It shows every problem and evidence summary plus exactly one complete fix prompt. A free account saves the report, reveals every available prompt, and includes 3 new URL checks. Re-checks on reports you own are unlimited and free.',
      },
      {
        type: 'ol',
        items: [
          'Paste your live URL (or a public preview URL).',
          'Wait for the scan to finish. You will see progress as it captures and checks.',
          'Open the Fix list. Select any Flag to inspect its screenshot, evidence, and available fix prompt.',
        ],
      },
    ],
    related: ['reading-your-report', 'public-urls-only', 'flag-fix-recheck'],
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
        text: 'Every report groups findings into three sections. Message covers copy and positioning. Experience covers layout, usability, and performance. Reach covers SEO metadata and link previews.',
      },
      {
        type: 'p',
        text: 'The Fix list contains every unresolved Flag, ranked by launch impact. Select a Flag to inspect its evidence, screenshot, and editor-ready prompt. Product context, journeys, previews, and launch gates continue below the workspace.',
      },
      {
        type: 'ul',
        items: [
          'Start at the top of the Fix list and copy one fix into your editor.',
          'Filter the complete list by rubric, severity, impact, or page.',
          'Copy one Flag or use Copy all fixes for a plan-mode prompt.',
        ],
      },
    ],
    related: ['scores-and-severity', 'flag-fix-recheck', 'first-check'],
  },
  {
    slug: 'flag-fix-recheck',
    categoryId: 'getting-started',
    title: 'Flag, fix, and re-check',
    excerpt: 'The core loop. Re-checks never count against your new-URL limit.',
    popular: true,
    searchTokens: ['recheck', 're-check', 'fix prompt', 'loop'],
    body: [
      {
        type: 'p',
        text: 'FixFlags is built around one loop: Flag → Fix → Re-check. Copy a fix prompt into your editor, apply the change, then re-check the same report.',
      },
      {
        type: 'p',
        text: 'Re-checks on reports you own are free and unlimited on every plan. They do not consume a new URL check or a credit pack.',
      },
      {
        type: 'callout',
        text: 'Pro adds before/after compare so you can prove what cleared and what is still open.',
      },
    ],
    related: ['rechecks-are-free', 'reading-your-report', 'what-counts-as-a-check'],
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
        text: 'Score starts at 100 and drops based on the number and severity of unresolved flags across Message, Experience, and Reach.',
      },
      {
        type: 'p',
        text: 'Each rubric starts at 100. Critical flags subtract more than Important, which subtract more than Polish. A rubric with any Critical flag is Blocked and its score stays below the Pass threshold. The overall score weights Experience highest, then Message, then Reach. Experience may also blend in PageSpeed when available.',
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
  },
  {
    slug: 'why-check-failed',
    categoryId: 'checks-and-reports',
    title: 'Why a check failed',
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
  },
  {
    slug: 'public-urls-only',
    categoryId: 'checks-and-reports',
    title: 'Public URLs only',
    excerpt: 'Public HTTPS URLs work everywhere. Agency projects can scan password-protected preview deploys.',
    searchTokens: ['localhost', 'staging', 'password', 'vpn', 'private', 'preview', 'basic auth'],
    body: [
      {
        type: 'p',
        text: 'FixFlags checks publicly reachable HTTPS URLs. Localhost and private networks are not supported.',
      },
      {
        type: 'p',
        text: 'Use a public preview URL from your host (Vercel, Netlify, Railway, and similar) when production is not ready.',
      },
      {
        type: 'p',
        text: 'On Agency, open a Project and configure preview scan access (HTTP basic auth or cookies) when a deploy is behind a password.',
      },
    ],
    related: ['why-check-failed', 'first-check'],
  },
  {
    slug: 'railway-deploy-check',
    categoryId: 'mcp-and-editors',
    title: 'Railway deploy check',
    excerpt: 'Enqueue a Launch Check after each Railway deployment succeeds.',
    searchTokens: ['railway', 'deploy', 'webhook', 'ci', 'preview', 'release'],
    body: [
      {
        type: 'p',
        text: 'FixFlags can enqueue a Launch Check when your Railway service deploys successfully. This is the supported post-deploy gate when you host on Railway (no GitHub Action or Vercel webhook required).',
      },
      {
        type: 'ol',
        items: [
          'Create a FixFlags API key from Settings → API keys (Pro or Agency).',
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
  },
  {
    slug: 'free-vs-pro',
    categoryId: 'billing-and-plans',
    title: 'Free vs Pro',
    excerpt: 'What you get on Free, Pro, and Agency.',
    popular: true,
    searchTokens: ['pricing', 'upgrade', 'agency', 'plan'],
    body: [
      {
        type: 'p',
        text: 'Free: 3 new URL checks with full reports and fix prompts, plus unlimited re-checks on reports you own.',
      },
      {
        type: 'p',
        text: 'Pro ($29/mo): before/after compare, MCP in Cursor or Claude, and 25 new URL checks per month.',
      },
      {
        type: 'p',
        text: 'Agency ($99/mo): 100 new URL checks per month, share links for client reports, and everything in Pro.',
      },
      {
        type: 'p',
        text: 'You can start free and upgrade anytime. Paid plans can buy credit packs for extra new checks when you hit the monthly cap.',
      },
    ],
    related: ['what-counts-as-a-check', 'credits', 'cancel-or-manage'],
  },
  {
    slug: 'what-counts-as-a-check',
    categoryId: 'billing-and-plans',
    title: 'What counts as a check',
    excerpt: 'New URL checks count. Re-checks do not. Failed scans that never produce a report do not use a credit.',
    searchTokens: ['quota', 'limit', 'credit', 'usage', 'scan'],
    body: [
      {
        type: 'p',
        text: 'A new URL check counts toward your plan limit. Each new URL you submit is a separate check.',
      },
      {
        type: 'p',
        text: 'Re-checking the same report does not use another credit. Failed scans that never produce a report do not use a credit.',
      },
    ],
    related: ['rechecks-are-free', 'credits', 'free-vs-pro'],
  },
  {
    slug: 'rechecks-are-free',
    categoryId: 'billing-and-plans',
    title: 'Re-checks are free',
    excerpt: 'Unlimited re-checks on reports you own. They never gate behind quota.',
    searchTokens: ['unlimited', 'free recheck'],
    body: [
      {
        type: 'p',
        text: 'Re-checks on reports you own are free and unlimited on every plan. They do not count toward your monthly or lifetime new-URL limit.',
      },
      {
        type: 'callout',
        text: 'You must own the report (signed-in account that ran or claimed the check). Anonymous private links cannot re-check until you save the report to an account.',
      },
    ],
    related: ['flag-fix-recheck', 'what-counts-as-a-check'],
  },
  {
    slug: 'credits',
    categoryId: 'billing-and-plans',
    title: 'Credit packs',
    excerpt: 'Overflow for paid plans when you need extra new URL checks.',
    searchTokens: ['credit pack', 'buy credits', 'overflow'],
    body: [
      {
        type: 'p',
        text: 'Paid plans can buy credit packs for extra new URL checks when you hit the monthly cap. Credits are overflow, not a replacement for your plan allowance.',
      },
      {
        type: 'p',
        text: 'Buy packs from Billing. Credits appear after Stripe confirms payment. Re-checks never consume credits.',
      },
    ],
    related: ['what-counts-as-a-check', 'free-vs-pro', 'payment-past-due'],
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
  },
  {
    slug: 'payment-past-due',
    categoryId: 'billing-and-plans',
    title: 'Payment past due',
    excerpt: 'Update your card in the billing portal to restore paid features.',
    searchTokens: ['past due', 'failed payment', 'card declined'],
    body: [
      {
        type: 'p',
        text: 'If a subscription payment fails, paid features pause until the payment succeeds. Open Billing and update your payment method in the Stripe customer portal.',
      },
      {
        type: 'p',
        text: 'Stripe will retry the charge after you update your card. If you need help, open chat from any page or email hello@fixflags.com.',
      },
    ],
    related: ['cancel-or-manage', 'contact-us', 'credits'],
  },
  {
    slug: 'mcp-setup',
    categoryId: 'mcp-and-editors',
    title: 'Set up MCP',
    excerpt: 'Connect FixFlags to Cursor, Claude Code, or Windsurf with an API key.',
    popular: true,
    searchTokens: ['mcp', 'cursor', 'claude code', 'windsurf', 'api'],
    body: [
      {
        type: 'p',
        text: 'MCP lets your agent check and fix your site without copy-pasting URLs. Pro plan required for API keys.',
      },
      {
        type: 'ol',
        items: [
          'Generate an API key in Settings → API Keys (Pro plan).',
          'Paste the HTTP config into Cursor, Claude Code, or Windsurf, or use one-click install from the MCP docs page.',
          'Run ff_check_and_plan to verify your key.',
        ],
      },
      {
        type: 'p',
        text: 'Full config examples and tool list live on the MCP guide. Public URLs only. Localhost and private sites are not reachable yet.',
      },
      {
        type: 'callout',
        text: 'Open the full MCP guide for install buttons, curl tests, and security notes.',
      },
    ],
    related: ['api-keys', 'lovable-bolt-paste', 'free-vs-pro'],
  },
  {
    slug: 'lovable-bolt-paste',
    categoryId: 'mcp-and-editors',
    title: 'Lovable and Bolt',
    excerpt: 'No MCP yet. Copy fix prompts from your report and paste them in.',
    searchTokens: ['lovable', 'bolt', 'v0', 'paste'],
    body: [
      {
        type: 'p',
        text: 'Lovable and Bolt do not support MCP yet. Copy fix prompts from your FixFlags report and paste them into those tools.',
      },
      {
        type: 'p',
        text: 'FixFlags still checks any publicly accessible URL regardless of how the site was built. Fix prompts are tuned for Cursor, Claude Code, Lovable, and Bolt.',
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
        text: 'API keys are available on Pro and Agency. Create them in Settings → API Keys. Keys are stored hashed on the server; we cannot recover a lost key. Rotate and create a new one if needed.',
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
        text: 'You can enable passkey-based two-factor authentication in Settings → Security. Keep backup codes somewhere safe.',
      },
      {
        type: 'p',
        text: 'After sign-in you always land on post-login so anonymous checks can be claimed before navigation. That keeps reports unlocked on your account.',
      },
    ],
    related: ['report-privacy', 'contact-us'],
  },
  {
    slug: 'report-privacy',
    categoryId: 'account',
    title: 'Report privacy',
    excerpt: 'Owned reports are private. Agency can create share links.',
    searchTokens: ['private', 'share', 'public', 'anonymous'],
    body: [
      {
        type: 'p',
        text: 'Owned reports are private to your account. Anonymous scans stay on a private link until you sign in and save them.',
      },
      {
        type: 'p',
        text: 'Agency plans can create revocable client share links with optional passwords, expiry, and view limits. Opening a share link does not make the underlying report public. Separate public discovery pages are not private reports.',
      },
    ],
    related: ['free-vs-pro', 'sign-in-and-security'],
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
    related: ['why-check-failed', 'payment-past-due', 'mcp-setup'],
  },
] as const
