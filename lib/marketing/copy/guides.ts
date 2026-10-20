import { PUBLIC_OFFER } from './public-offer'

export const GUIDE_REVIEWED_AT = '2026-10-20'

export const GUIDES_PAGE = {
  eyebrow: 'Website guides',
  title: 'Know what to check next.',
  description: 'Practical checks after publishing, troubleshooting paths, and comparisons that start with the evidence you need.',
  metadataTitle: 'Website checking and monitoring guides | FixFlags',
  start: 'Check your website',
  pricing: 'See current pricing',
  back: 'All guides',
  contents: 'On this page',
  reviewed: 'Sources and coverage reviewed',
  sources: 'Sources and scope',
  sourceNote: 'External sources describe their own products. FixFlags coverage is documented separately. Examples below are controlled illustrations, not customer results.',
  exampleLabel: 'Controlled example',
  related: 'Keep going',
  coverageLink: 'FixFlags coverage and limits',
  docsLink: 'Check, fix, and verify with AI',
  nextTitle: 'Check the live website you are responsible for.',
  offer: PUBLIC_OFFER.free,
  offerLimits: PUBLIC_OFFER.availability,
} as const

export type GuideSource = { title: string; href: string; supports: string }
export type WebsiteGuide = {
  slug: string
  title: string
  description: string
  decision: string
  sections: { id: string; title: string; paragraphs: string[]; sourceIds?: number[] }[]
  example: { title: string; paragraphs: string[] }
  sources: GuideSource[]
  related: string[]
}

const coverage: GuideSource = { title: 'FixFlags: coverage and limits', href: '/coverage', supports: 'Current public checks, configured journeys, evidence scope, and incomplete results.' }
const mdn: GuideSource = { title: 'MDN: 200 OK', href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/200', supports: 'An HTTP 200 response establishes success for that request, with meaning depending on the request method.' }
const lovable: GuideSource = { title: 'Lovable: publish your project', href: 'https://docs.lovable.dev/features/publish', supports: 'Publishing deploys a snapshot to a live URL. Later edits require publishing changes.' }
const uptime: GuideSource = { title: 'UptimeRobot: monitor types', href: 'https://help.uptimerobot.com/en/articles/11358441-understanding-uptimerobot-monitor-types-a-guide-to-essential-services', supports: 'HTTP status checks, keyword checks, and other distinct monitor types.' }
const api: GuideSource = { title: 'UptimeRobot: API monitoring', href: 'https://help.uptimerobot.com/en/articles/13628553-uptimerobot-api-monitoring', supports: 'API monitoring can assert response fields, headers, status codes, and response bodies.' }
const checkly: GuideSource = { title: 'Checkly: browser checks overview', href: 'https://www.checklyhq.com/docs/detect/synthetic-monitoring/browser-checks/overview/', supports: 'Playwright browser scripts can interact with pages, assert outcomes, collect results, and trigger alerts.' }

export const WEBSITE_GUIDES: WebsiteGuide[] = [
  {
    slug: 'monitoring-ai-built-websites',
    title: 'How to monitor an AI-built website',
    description: 'Choose checks around real visitor tasks, keep the evidence, and verify changes after your AI tool publishes them.',
    decision: 'Start with the most important public journey. Add a configured test only when you can define its safe inputs and success condition.',
    sections: [
      { id: 'choose-a-task', title: 'Turn “it works” into an observable task', paragraphs: [
        'An AI-built website still needs a clear acceptance condition. Write down who visits, which page they open, what they choose, and what should happen next. “The website works” is too broad to investigate. “The pricing button opens the current plans page on a phone” gives you a page, an action, and an outcome to inspect.',
        'Choose one path that matters today, such as a campaign page leading to signup or a product page leading to the cart. List the public steps separately from account creation, payment, and private data. This prevents a successful homepage check from becoming a claim about behavior that nobody exercised.',
      ] },
      { id: 'pick-coverage', title: 'Match the check to the question', paragraphs: [
        'FixFlags starts with reachable public pages. Depending on the checked scope and available evidence, it can examine page availability, action destinations, mobile behavior, search metadata, performance, accessibility, and other published coverage. A screenshot helps explain what appeared, but an image alone cannot establish that an action completed.',
        'Purchase-path checks stop before payment. Signup verification needs supported behavior and authorized, reversible test conditions. Login and password reset are not currently available. Review coverage before depending on any particular step. New MCP connections and planned paid integrations are not available in the website beta.',
      ], sourceIds: [0] },
      { id: 'publish-and-check', title: 'Make each release a repeatable loop', paragraphs: [
        'Run a check against the live URL, inspect a Flag, and give its evidence and fix guidance to your developer or coding tool. Review the proposed change before publishing. Then request a fresh check of the same page and behavior. Your coding tool saying “fixed” is a useful progress note, but it is not independent verification of the live result.',
        'Save the Site and enable the supported monitoring you need. Scheduled checks observe the website when they run, not continuously between runs. Keep the check time and scope with the result. After a major navigation or account-flow change, revisit the monitoring setup instead of assuming the old path still represents your visitors.',
      ] },
      { id: 'read-unknowns', title: 'Leave room for unknowns', paragraphs: [
        'A blocked destination, failed provider, or unfinished browser step leaves an evidence gap. Couldn’t verify means that the check cannot establish the result. It should not be read as a pass. Content suggestions also do not demonstrate improved conversion. For critical private workflows, retain manual review or a separately configured scripted test with a precise success condition. Assign an owner to every unresolved task so an incomplete run has a concrete next step.',
      ] },
    ],
    example: { title: 'A pricing button after a generated redesign', paragraphs: [
      'In this controlled illustration, a fictional studio replaces its homepage and the pricing button points to /plans-old. The homepage loads, but the destination returns an error. The useful finding names the source page, button destination, observed response, and check time.',
      'After changing the link to /pricing and publishing, a fresh check must reach the intended plans page from the same button. That would verify this navigation step at that time. It would not establish signup, payment completion, or increased sales.',
    ] },
    sources: [coverage], related: ['checking-after-publishing', 'fixflags-vs-scripted-browser-monitoring'],
  },
  {
    slug: 'checking-after-publishing',
    title: 'What to check after publishing a website',
    description: 'A release checklist focused on the public URL, important destinations, mobile use, and fresh evidence after a fix.',
    decision: 'Before sending visitors to a release, verify the live entry page and its next step. Keep unresolved checks visible.',
    sections: [
      { id: 'identify-release', title: 'Check the release visitors can actually reach', paragraphs: [
        'Start with the URL you will share, including its real domain and relevant page path. A preview can use different configuration, routing, and access rules. Record what changed and when it was published. If there is uncertainty about which version is live, resolve it before comparing screenshots or asking an AI tool to diagnose behavior.',
        'Open an entry page directly, then follow its main action. Check a deeper page directly as well as through navigation. A destination can work from the homepage yet fail on refresh. Keep query parameters only when they are needed for the task, and never put private information or credentials into a public checking URL.',
      ] },
      { id: 'follow-path', title: 'Follow the promise to its destination', paragraphs: [
        'For a landing page, ask whether the headline, button, and destination describe the same next step. For a store, inspect the product, cart, and permitted checkout entry. For a service site, verify the contact destination and required form labels. Stop before an action that creates a real booking, lead, order, or other consequence unless you have authorized safe test conditions.',
        'Repeat the visible navigation on a phone-sized layout. Look for menus that cannot open, overlays covering controls, missing feedback, and important actions pushed out of reach. Include keyboard access and readable labels. These observations are more actionable when tied to the affected page and recorded viewport rather than a general impression that mobile looks wrong.',
      ] },
      { id: 'check-presentation', title: 'Check discovery and presentation separately', paragraphs: [
        'Review titles, descriptions, canonical URLs, indexing directives, and link previews for the pages you intend to share. Check image availability and noticeable loading delays. A successful response is evidence about a request; it does not demonstrate that a visitor completed a task or that search engines indexed the release.',
        'FixFlags can collect supported public website evidence across these areas. Available performance measurements describe the checked page and run. Automated accessibility findings are partial evidence, not a complete accessibility certification. Detected analytics markup does not prove events reached an analytics service or that attribution is correct.',
      ], sourceIds: [0, 1] },
      { id: 'resolve-and-repeat', title: 'Verify the fix before accepting the release', paragraphs: [
        'Give each problem a concrete expected result. Publish the correction, then rerun the same check against the live page. Compare new evidence with the original failure and preserve remaining gaps. A developer report or AI summary is not independent verification. Save your Site and configure monitoring for supported checks that should continue after launch.',
        'FixFlags purchase-path checks stop before payment. The website beta does not make new MCP connections or planned paid integrations available. Review current coverage before treating signup, private pages, or third-party services as checked. A blocked or incomplete result remains Couldn’t verify. Decide explicitly whether an unresolved critical task should delay the visitor-facing announcement.',
      ], sourceIds: [0] },
    ],
    example: { title: 'A published contact-page update', paragraphs: [
      'In this controlled illustration, a fictional consultancy publishes a new contact page. Its homepage button still targets a deleted route. A check records that broken destination. Correcting the link and publishing is the fix step, not the acceptance condition.',
      'A fresh run should follow the original button to the contact page and show the expected form. Without an authorized submission test and evidence of its outcome, the result says nothing about message delivery. Keep that delivery check as a separate open task.',
    ] }, sources: [coverage, mdn], related: ['website-online-but-not-working', 'monitoring-ai-built-websites'],
  },
  {
    slug: 'website-online-but-not-working',
    title: 'Your website is online, but is it working?',
    description: 'Separate successful HTTP responses from rendered pages, usable actions, and completed customer tasks.',
    decision: 'When uptime is green but visitors report a failure, reproduce the exact page and action before changing the monitor.',
    sections: [
      { id: 'separate-signals', title: 'Separate availability from the task', paragraphs: [
        'An HTTP 200 response means a request succeeded according to HTTP semantics. It is not a complete description of the resulting experience. The server can return the page shell while a browser-side dependency fails, a button links to an obsolete route, or a form shows no useful feedback. Start by identifying which layer the available evidence actually covers.',
        'Write down the reported URL, approximate time, device, and action. Ask what should have appeared next. Avoid collecting passwords or customer records as diagnostic material. A report that “checkout is broken” becomes easier to investigate when narrowed to “Add to cart leaves the cart empty on this product page.”',
      ], sourceIds: [1] },
      { id: 'reproduce', title: 'Follow a short diagnostic sequence', paragraphs: [
        'First check whether the specific URL responds. Then inspect whether the expected content renders. Follow the main action and inspect its destination. For an interactive control, distinguish a click being accepted from the expected state appearing. Record where the sequence stops, including timeouts and blocked destinations. Do not jump from a blank screen to a confident claim about its underlying cause.',
        'Repeat only the relevant conditions. A mobile-menu failure calls for the same narrow viewport; a deep-link failure calls for opening that route directly. If the behavior is intermittent, retain separate run times and observations. A later success does not invalidate an earlier failure, and a single successful attempt does not establish that the issue cannot recur.',
      ] },
      { id: 'choose-evidence', title: 'Use evidence that can distinguish outcomes', paragraphs: [
        'FixFlags can help inspect supported public pages and action destinations, with findings tied to the recorded check. Purchase checks stop before payment. Authorized signup setups have their own requirements. Login and password reset are unavailable in the current website beta. New MCP connections and planned paid integrations are not available either.',
        'A screenshot can show an empty cart or loading state, but the recorded actions and observations explain how it got there. Read the scope before interpreting a clear result. A performance measurement does not confirm form delivery, and detected analytics markup does not establish that a conversion event was received.',
      ], sourceIds: [0] },
      { id: 'confirm-recovery', title: 'Confirm recovery on the same path', paragraphs: [
        'Pass the affected page, observed failure, expected behavior, and evidence to whoever changes the website. Review and publish the fix. Then run a fresh independent verification of the original action. Keep the original acceptance condition: reaching a checkout page should not quietly become proof that a payment succeeded.',
        'If a provider cannot respond, access is blocked, or a run ends early, Couldn’t verify preserves the uncertainty. Keep investigating with authorized manual checks or another suitable test. Monitor the layer you need after recovery, and remember that scheduled observations leave intervals between runs.',
      ] },
    ],
    example: { title: 'A healthy homepage and an empty cart', paragraphs: [
      'In this controlled illustration, a fictional shop homepage returns 200 and displays its products. Clicking Add to cart on one product leaves the cart empty. The availability observation and the cart failure can both be true.',
      'After a correction is published, the relevant fresh check adds that product and observes it in the cart. If checkout entry is also checked, record that separately. No payment is entered, no order is placed, and this example makes no claim about customer revenue.',
    ] }, sources: [coverage, mdn], related: ['fixflags-vs-uptime-monitoring', 'checking-after-publishing'],
  },
  {
    slug: 'checking-lovable-websites',
    title: 'How to check a published Lovable website',
    description: 'Check the public version of your Lovable project, turn a finding into a focused fix, and verify the published result.',
    decision: 'Use the published visitor URL as the checking target. Confirm that a correction has been published before verifying it.',
    sections: [
      { id: 'public-version', title: 'Start from the published version', paragraphs: [
        'Lovable documents publishing as deploying a snapshot to a live URL. Later edits need Publish changes to reach that published version. Check the visitor-facing address rather than assuming the editor preview and live website are identical. If you use a custom domain, use the domain you give visitors and confirm that it reaches the intended release.',
        'Check only a project you own or have permission to test. Choose a reachable public entry page and describe its intended next step. If the app is restricted to selected viewers, a public checker may be unable to enter it. Treat that as a coverage constraint instead of making the project public merely to get a check result.',
      ], sourceIds: [1] },
      { id: 'public-checks', title: 'Check the public journey before private flows', paragraphs: [
        'Start with the headline, navigation, pricing or contact destination, mobile menu, and the main call to action. Open important nested routes directly. Inspect whether images load and whether the next page offers the promised action. Check page titles, descriptions, search directives, and link previews where those matter for launch.',
        'FixFlags checks the live website through its supported public coverage. It does not need a special Lovable connection for a reachable public page. That does not give it access to your project source, database policies, or private records. New MCP connections and planned paid integrations are unavailable in the website beta.',
      ], sourceIds: [0] },
      { id: 'focused-prompt', title: 'Give Lovable a bounded fix request', paragraphs: [
        'Use the affected URL, recorded observation, expected behavior, and available fix guidance. Ask for the smallest change that restores the intended result. For example, identify the button and its wrong destination rather than asking the builder to improve the entire site. Keep secrets, customer data, and private screenshots out of a public prompt or report.',
        'Review the generated changes, including related navigation and mobile behavior. Publish the correction, then use a fresh check against the same public URL. Independent verification comes from new evidence of the original behavior, not from the builder explaining that its own edit should work. Preserve unresolved steps if the run cannot reach them.',
      ] },
      { id: 'limits', title: 'Keep app security and task verification distinct', paragraphs: [
        'Public website checks cannot establish that database access rules or every account permission are correct. Review those through the appropriate project and security tooling. In FixFlags, signup verification requires supported forms and authorized, reversible test conditions. Login and password reset are not currently available, and purchase-path checks stop before payment.',
        'After the release is checked, save the Site and configure supported monitoring for the public paths that matter. Review the setup whenever the generated app changes its routes or main task. Couldn’t verify remains an unknown when access or execution is blocked. A clear public-page result does not certify the whole application.',
      ], sourceIds: [0] },
    ],
    example: { title: 'A fix visible in preview but absent from the live page', paragraphs: [
      'In this controlled illustration, a fictional Lovable project has a mobile menu button that does not open. A change appears correct in preview, but the published visitor URL still shows the failure. The useful next step is to establish which version is live.',
      'Once the correction is published, a fresh check opens the same live page at the recorded mobile viewport and exercises the menu. Observing it open verifies that interaction for that run. It does not prove that restricted pages, signup emails, or payments work.',
    ] }, sources: [coverage, lovable], related: ['monitoring-ai-built-websites', 'checking-after-publishing'],
  },
  {
    slug: 'fixflags-vs-uptime-monitoring',
    title: 'FixFlags and uptime monitoring: which checks do you need?',
    description: 'Compare availability signals with public website and journey evidence, without treating one green check as proof of everything.',
    decision: 'Choose the tool by its configured assertion. Use availability monitoring for reachability and a behavior check for the visitor task.',
    sections: [
      { id: 'compare-assertions', title: 'Compare assertions, not product categories', paragraphs: [
        'A basic availability check asks whether a chosen URL responds as expected. A behavior check asks whether a specific interaction reaches its expected outcome. Both can matter. Before choosing a service, list the failures you need to notice and the evidence you would need to distinguish a real failure from a blocked or incomplete check.',
        'UptimeRobot documents HTTP monitoring based on response statuses and keyword monitoring for page content. Its API monitoring also supports assertions on response fields, headers, status codes, and bodies. These are different capabilities. It would be inaccurate to describe every uptime product as checking only whether a server answers.',
      ], sourceIds: [1, 2] },
      { id: 'fixflags-fit', title: 'Where FixFlags fits', paragraphs: [
        'FixFlags combines supported public website checks with page and journey observations, evidence, and fix guidance. Depending on scope and available execution, it can examine action destinations, mobile behavior, performance, accessibility, search metadata, and other listed coverage. Its usefulness depends on whether those supported checks match the problem you need to investigate.',
        'It is not a replacement for every infrastructure or application monitor. Purchase-path checks stop before payment. Signup needs supported behavior and authorized test conditions. Login and password reset are unavailable in the website beta. New MCP connections and planned paid integrations are unavailable. Check the coverage details before choosing it for a critical private workflow.',
      ], sourceIds: [0] },
      { id: 'selection', title: 'Make a small selection worksheet', paragraphs: [
        'For each important task, write the target, expected condition, required access, owner, and acceptable time between observations. For a public homepage, an expected response or content condition may be enough. For a product button, you may need evidence that a selected item appears in the cart. For a private transaction, you may need a scripted test under separately managed safe conditions.',
        'Then ask each candidate service how that precise condition is configured, what evidence a failure retains, and how an incomplete run appears. Review the current plan and schedule rather than assuming equal coverage or equal frequency. No price comparison can settle whether the service actually exercises your required task.',
      ] },
      { id: 'operate', title: 'Keep useful signals together', paragraphs: [
        'If you already have availability monitoring, keep its role explicit while adding checks for uncovered visitor behavior. Give each alert an owner and a recovery condition. After a fix is published, obtain fresh independent verification on the same task. A green availability signal can support the investigation without closing a behavior failure.',
        'In FixFlags, blocked or incomplete evidence remains Couldn’t verify. Scheduled checks observe particular times, leaving gaps between runs. A successful cart check does not establish payment completion or revenue impact. Evaluate the current beta offer and limitations on Pricing before depending on future paid access.',
      ] },
    ],
    example: { title: 'The product page responds, but the button fails', paragraphs: [
      'In this controlled illustration, a fictional product page returns the expected successful HTTP response and product title. A configured availability or keyword check can pass while Add to cart fails to update the cart. Those observations answer separate questions.',
      'The acceptance condition for the behavior fix is a fresh observation of the product in the cart after the original action. Keep the availability check for reachability. Record checkout entry separately, and stop before payment. This is a decision example, not a benchmark or customer outcome.',
    ] }, sources: [coverage, uptime, api], related: ['website-online-but-not-working', 'fixflags-vs-scripted-browser-monitoring'],
  },
  {
    slug: 'fixflags-vs-scripted-browser-monitoring',
    title: 'FixFlags and scripted browser monitoring: how to choose',
    description: 'Choose between supported website checks and explicit browser assertions based on the task, safe test setup, and maintenance you can own.',
    decision: 'Use an explicit script when you need a precise custom workflow. Use FixFlags where its documented public coverage matches the evidence you need.',
    sections: [
      { id: 'scripted-checks', title: 'What a browser script can establish', paragraphs: [
        'A scripted browser check specifies actions and expected results. The team chooses the pages, test inputs, assertions, and stopping point. Checkly documents Playwright browser checks with page interactions, assertions, retained execution results, and alerts. This can suit a workflow whose exact success condition and test environment you control.',
        'A script still needs good assertions. Clicking Submit and reaching the next line does not by itself establish that a message was delivered. Decide which visible or authorized backend evidence proves the task, which failures should alert, and how test data is removed. Someone needs to own the test as routes, labels, and business rules change.',
      ], sourceIds: [1] },
      { id: 'supported-coverage', title: 'What FixFlags offers today', paragraphs: [
        'FixFlags starts with supported checks of reachable public website pages, recorded observations, Flags, and fix guidance. It can help a website owner inspect supported page and journey problems without first describing every public interaction in a custom script. The documented coverage and the recorded scope determine what any individual result establishes.',
        'It does not promise arbitrary private workflow execution. Signup verification requires supported behavior, authorization, and reversible test conditions. Login and password reset are unavailable in the website beta. Purchase-path checks stop before payment. New MCP connections and planned paid integrations are unavailable. A custom workflow outside those limits needs a separate approach.',
      ], sourceIds: [0] },
      { id: 'choose-path', title: 'Choose by the job and its owner', paragraphs: [
        'Choose a scripted approach when your requirement includes a precise sequence, controlled fixtures, private state, or custom assertions outside supported coverage. Before selecting a service, confirm that its browser, access model, scheduling, execution limits, and retained evidence fit that sequence. A private workflow deserves explicit authorization and a cleanup owner.',
        'Consider FixFlags when you need evidence about supported public pages and next steps, then want to hand the observed problem to your developer or AI tool. Run a small representative check and read its scope before making a wider monitoring decision. Neither approach removes the need to review changes or understand what remained untested.',
      ] },
      { id: 'verification', title: 'Use the same recovery standard', paragraphs: [
        'For either approach, define the expected result before changing the site. Review the fix, publish it, and get fresh independent verification of that result. A repaired script that no longer asserts the original condition can hide a product failure. A clear public-page check can also miss a private requirement that was never in its scope.',
        'In FixFlags, an interrupted or blocked check remains Couldn’t verify. Scheduled runs do not establish continuous health between observations. Keep manual review for uncovered important tasks, and use current Pricing and coverage documentation when evaluating the beta. Choose complementary checks where each adds a clear, owned signal rather than duplicating alerts without a response plan.',
      ] },
    ],
    example: { title: 'Public signup entry and a private approval workflow', paragraphs: [
      'In this controlled illustration, a fictional software site needs two checks: the homepage signup button reaches the intended page, and an authorized test user can submit a private approval request. These have different access, data, and cleanup requirements.',
      'A supported public destination check can address the first question. The private approval path needs a separately configured test with explicit assertions and safe reset conditions. Passing either check does not establish the other. This example makes no claim about comparative speed, cost, or reliability.',
    ] }, sources: [coverage, checkly], related: ['fixflags-vs-uptime-monitoring', 'monitoring-ai-built-websites'],
  },
]

export function getWebsiteGuide(slug: string) {
  return WEBSITE_GUIDES.find(guide => guide.slug === slug)
}
