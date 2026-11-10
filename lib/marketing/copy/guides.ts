import { PUBLIC_OFFER } from './public-offer'
import type { WebsiteGuideSlug } from '@/lib/analytics/guide-entry'

export const GUIDE_REVIEWED_AT = '2026-10-20'

export const GUIDES_PAGE = {
  eyebrow: 'Website guides',
  title: 'Find it, fix it, and know it worked.',
  description: 'Plain-language guides to checking your website, copying a fix, and knowing it worked.',
  metadataTitle: 'Website checking and monitoring guides | FixFlags',
  start: 'Check your website',
  pricing: 'See current pricing',
  back: 'All guides',
  contents: 'On this page',
  reviewed: 'Sources and coverage reviewed',
  sources: 'Sources and scope',
  sourceNote: 'External sources describe their own products. These examples are demos, not customer results. Purchase checks stop before payment. Signup checks need a supported, safe test setup. Login and password reset, new MCP connections, and planned paid integrations are not available in the website beta.',
  exampleLabel: 'Controlled example',
  related: 'Keep going',
  coverageLink: 'FixFlags coverage and limits',
  docsLink: 'How to copy and paste a fix',
  nextTitle: 'Try a check on your website.',
  offer: PUBLIC_OFFER.free,
  offerLimits: PUBLIC_OFFER.availability,
} as const

export type GuideSource = { title: string; href: string; supports: string }
export type WebsiteGuide = {
  slug: WebsiteGuideSlug
  title: string
  description: string
  decision: string
  sections: { id: string; title: string; paragraphs: string[]; sourceIds?: number[] }[]
  example: { title: string; paragraphs: string[] }
  sources: GuideSource[]
  related: string[]
  /** Set when a guide was written or re-reviewed after the shared review date. */
  reviewedAt?: string
}

export function guideReviewedAt(guide: Pick<WebsiteGuide, 'reviewedAt'>): string {
  return guide.reviewedAt ?? GUIDE_REVIEWED_AT
}

const coverage: GuideSource = { title: 'FixFlags: coverage and limits', href: '/coverage', supports: 'Current public checks, configured journeys, evidence scope, and incomplete results.' }
const mdn: GuideSource = { title: 'MDN: 200 OK', href: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/200', supports: 'An HTTP 200 response establishes success for that request, with meaning depending on the request method.' }
const lovable: GuideSource = { title: 'Lovable: publish your project', href: 'https://docs.lovable.dev/features/publish', supports: 'Publishing deploys a snapshot to a live URL. Later edits require publishing changes.' }
const uptime: GuideSource = { title: 'UptimeRobot: monitor types', href: 'https://help.uptimerobot.com/en/articles/11358441-understanding-uptimerobot-monitor-types-a-guide-to-essential-services', supports: 'HTTP status checks, keyword checks, and other distinct monitor types.' }
const api: GuideSource = { title: 'UptimeRobot: API monitoring', href: 'https://help.uptimerobot.com/en/articles/13628553-uptimerobot-api-monitoring', supports: 'API monitoring can assert response fields, headers, status codes, and response bodies.' }
const stripeKeys: GuideSource = { title: 'Stripe: API keys', href: 'https://docs.stripe.com/keys', supports: 'Sandbox and live mode each have their own API keys, and objects in one mode are not accessible to the other.' }
const stripeWebhooks: GuideSource = { title: 'Stripe: receive events in your webhook endpoint', href: 'https://docs.stripe.com/webhooks', supports: 'Webhook endpoints are registered at a public HTTPS URL, each endpoint has its own signing secret, and redirects count as failed deliveries.' }
const lighthouse: GuideSource = { title: 'Chrome for Developers: Lighthouse overview', href: 'https://developer.chrome.com/docs/lighthouse/overview', supports: 'Lighthouse audits one page per run for performance, accessibility, SEO and more, from DevTools, the command line or PageSpeed Insights.' }
const pagespeed: GuideSource = { title: 'Google for Developers: about PageSpeed Insights', href: 'https://developers.google.com/speed/docs/insights/v5/about', supports: 'PageSpeed Insights reports lab data from Lighthouse and field data from real Chrome users, for mobile and desktop.' }
const checkly: GuideSource = { title: 'Checkly: browser checks overview', href: 'https://www.checklyhq.com/docs/detect/synthetic-monitoring/browser-checks/overview/', supports: 'Playwright browser scripts can interact with pages, assert outcomes, collect results, and trigger alerts.' }

export const WEBSITE_GUIDES: WebsiteGuide[] = [
  {
    slug: 'monitoring-ai-built-websites',
    title: 'You built a website. How do you keep it working?',
    description: 'Find the problems you missed, copy the fix instructions, and check the result after publishing.',
    decision: 'Start with the pages your visitors use most. You don’t need to write a test script to check public pages.',
    sections: [
      { id: 'choose-a-task', title: 'Start with what people came to do', paragraphs: [
        'What should someone be able to do on your website? Read your plans, open a contact page, or add a product to the cart? Pick a useful next step and check it. A homepage that loads does not tell you whether the next button works.',
        'Try the important pages on your phone too. Look for menus that won’t open, buttons hidden behind popups, and pages that take too long to appear.',
      ] },
      { id: 'pick-coverage', title: 'Enter your website address', paragraphs: [
        'FixFlags checks public pages for broken links, slow loading, mobile problems, and more. Each result tells you which pages and actions were checked. Open a problem, called a Flag, to see what happened and the instructions to help fix it.',
        'Nothing needs to be installed for a public-page check. Pages behind a login and actions such as signup have different requirements. Read the coverage details before relying on a check for those steps.',
      ], sourceIds: [0] },
      { id: 'publish-and-check', title: 'Copy, paste, and check the update', paragraphs: [
        'Copy the fix instructions and paste them into the chat where you built your website. You can also send them to a developer. Review the change and publish it. Then open the problem in FixFlags and select Check now.',
        'We check the live website again to see if the problem is gone. That is independent verification: a new check of the result, rather than relying on a message saying the edit is done. Save your website to keep getting scheduled checks.',
      ] },
      { id: 'read-unknowns', title: 'Know what couldn’t be checked', paragraphs: [
        'Couldn’t verify means a check was blocked or could not finish. It does not count as a pass. A result applies to the pages and actions checked at that time. Scheduled checks leave time between runs, so keep reviewing important changes yourself too.',
      ] },
    ],
    example: { title: 'A pricing button that opens the wrong page', paragraphs: [
      'In this controlled illustration, a demo website’s pricing button points to /plans-old, a page that no longer exists. The homepage loads, but visitors cannot open the plans.',
      'The fix changes the link to /pricing. After publishing, a new check follows the same button to the plans page. It confirms that step, without making any claim about signup, payments, or sales.',
    ] },
    sources: [coverage], related: ['checking-after-publishing', 'fixflags-vs-scripted-browser-monitoring'],
  },
  {
    slug: 'checking-after-publishing',
    title: 'Your update is live. What should you check?',
    description: 'A simple check of your pages, buttons, phone layout, and shared links after publishing.',
    decision: 'Check the website address your visitors use, then follow its main button to the next page.',
    sections: [
      { id: 'identify-release', title: 'Open the live website', paragraphs: [
        'Use the address you give visitors. A preview can look right while the live website still shows an older version. Make sure your update is published before checking it.',
        'Open an important page directly as well as through the menu. A link might work from the homepage but fail when someone opens it from a bookmark or refreshes the page. Keep passwords and private information out of the address you submit.',
      ] },
      { id: 'follow-path', title: 'Try the next step', paragraphs: [
        'Does the main button lead where it says? Can you reach the contact page? Can a shopper add an item to the cart? Follow the steps your visitors need. Stop before making a real booking, sending a real lead, or placing an order unless you have a safe, authorized test setup.',
        'Try the page on your phone. Check the menu, look for popups covering buttons, and make sure text and form labels are readable. Try using the keyboard too.',
      ] },
      { id: 'check-presentation', title: 'Look beyond the homepage', paragraphs: [
        'Check the title, image, and description that appear when you share a link. Look for missing images, slow loading, and unfinished text. FixFlags can help check these public website basics and show what needs attention.',
        'A page that responds successfully may still have broken buttons. Automated accessibility checks also cover only part of what people need. An analytics tag on the page does not prove visits are being recorded correctly.',
      ], sourceIds: [0, 1] },
      { id: 'resolve-and-repeat', title: 'Check the fix after publishing', paragraphs: [
        'Copy the fix instructions, paste them where you built the website, review the change, and publish it. Then ask FixFlags to check the same problem again. This new check is independent verification of the live result.',
        'If the page is blocked or the check cannot finish, you’ll see Couldn’t verify. Keep that problem open until you can confirm it works. Save your website if you want scheduled checks after launch.',
      ], sourceIds: [0] },
    ],
    example: { title: 'A contact page with an old link', paragraphs: [
      'In this controlled illustration, a demo website gets a new contact page. The homepage button still opens the deleted page. A check finds the broken link.',
      'After the link is corrected and published, a new check reaches the contact page. That confirms the link works. It does not confirm messages are delivered without a separate, authorized form test.',
    ] }, sources: [coverage, mdn], related: ['website-online-but-not-working', 'monitoring-ai-built-websites'],
  },
  {
    slug: 'website-online-but-not-working',
    title: 'Your website is online. Is everything working?',
    description: 'A page can load while its buttons, forms, or cart are broken. Here’s what to look for.',
    decision: 'When someone reports a problem, start with the page and the button they used.',
    sections: [
      { id: 'separate-signals', title: 'Online is only the first question', paragraphs: [
        'A website can respond successfully and still leave visitors stuck. A page might load without its menu, link to a deleted page, or show an empty cart after someone selects Add to cart.',
        'Ask which page they opened, what they tried, what happened, and roughly when. Find out whether they were on a phone or computer. You don’t need their password or private account details to start investigating.',
      ], sourceIds: [1] },
      { id: 'reproduce', title: 'Try the same step', paragraphs: [
        'Open the page, wait for its content, and try the button. Notice where things stop. Does the next page open? Does the product appear in the cart? Does the screen show an error or keep loading?',
        'Use the same kind of screen when that matters. A broken phone menu might work on a laptop. If the problem comes and goes, keep the times of both failures and successes. One successful attempt does not erase an earlier problem.',
      ] },
      { id: 'choose-evidence', title: 'See what FixFlags found', paragraphs: [
        'FixFlags checks supported public pages and actions, then keeps the details with each problem. A screenshot can help explain an empty cart; the recorded steps explain how it happened. Read what was checked before treating a result as a pass for the whole website.',
        'Loading speed, contact messages, and analytics are different questions. A fast page does not prove a form delivers messages. A visible analytics tag does not prove a visit was recorded.',
      ], sourceIds: [0] },
      { id: 'confirm-recovery', title: 'Fix the problem, then try again', paragraphs: [
        'Copy the fix instructions and paste them where you make website changes, or send them to someone who can help. Review and publish the update. Then run the same check again for independent verification that the live fix worked.',
        'Couldn’t verify means we could not confirm the result. A blocked page or unfinished check stays unconfirmed. Keep checking important steps yourself when they are outside the available coverage.',
      ] },
    ],
    example: { title: 'The shop loads, but the cart stays empty', paragraphs: [
      'In this controlled illustration, a demo shop’s homepage loads and shows its products. But Add to cart leaves the cart empty. Being online and having a broken cart can both be true.',
      'After the fix is published, a new check adds the product and finds it in the cart. Opening checkout is a separate step. No payment or order is made in this example.',
    ] }, sources: [coverage, mdn], related: ['fixflags-vs-uptime-monitoring', 'checking-after-publishing'],
  },
  {
    slug: 'checking-lovable-websites',
    title: 'Built with Lovable? Check the live website.',
    description: 'Find problems on your published website, paste the fix instructions into Lovable, and check the update.',
    decision: 'Use the website address your visitors open. Publish your changes before checking them.',
    sections: [
      { id: 'public-version', title: 'Start with the published website', paragraphs: [
        'Lovable documents publishing as deploying a snapshot to a live URL. Later edits need Publish changes to reach that published version. Use the address you give visitors, including your custom domain if you have one.',
        'Only check a website you own or have permission to test. If it is private, a public check may be unable to open it. You don’t need to make a private app public just to get a result.',
      ], sourceIds: [1] },
      { id: 'public-checks', title: 'Check the pages people use', paragraphs: [
        'Start with the menu, main button, pricing or contact page, and phone layout. Open important pages directly. Look for missing images and slow loading. Check how shared links look too.',
        'Public-page checks do not need a Lovable connection. Enter your live website address in FixFlags. Results tell you what was checked and where a closer look is needed. They do not inspect your private records or the rules controlling access to them.',
      ], sourceIds: [0] },
      { id: 'focused-prompt', title: 'Copy the instructions into Lovable', paragraphs: [
        'Open a problem in FixFlags and copy its fix instructions. Paste them into your project’s Lovable chat, just as you would ask for another change. The instructions include the page, what went wrong, and what should happen instead. Keep passwords and private customer data out of the chat.',
        'Review the change and publish it. Then return to the problem in FixFlags and select Check now. This gives you independent verification of the live result, rather than relying on the preview or a message saying the change is done.',
      ] },
      { id: 'limits', title: 'Keep important limits in mind', paragraphs: [
        'Public website checks do not confirm every account permission or database access rule. Those need their own review. A page that could not be reached stays Couldn’t verify, rather than passing.',
        'Save your website to get scheduled checks. If you change the main pages or signup process, review what gets checked so it still matches what your visitors need.',
      ], sourceIds: [0] },
    ],
    example: { title: 'The phone menu works in preview, but not live', paragraphs: [
      'In this controlled illustration, a demo website’s phone menu will not open. A change fixes it in preview, but the live page still has the old problem.',
      'Once the update is published, a new check opens the same live page at the same phone screen size and tries the menu. That confirms this step for that check, not every private page, signup email, or payment.',
    ] }, sources: [coverage, lovable], related: ['monitoring-ai-built-websites', 'checking-after-publishing'],
  },
  {
    slug: 'fixflags-vs-uptime-monitoring',
    title: 'Your website is online. What else should you check?',
    description: 'Understand the difference between checking a page is online and checking what visitors can do.',
    decision: 'Choose checks for the problems you need to find, from a website going offline to a broken cart.',
    sections: [
      { id: 'compare-assertions', title: 'Start with the question', paragraphs: [
        'Does the page respond? Does the right content appear? Does Add to cart actually add the product? These are different questions. Before choosing a service, decide which problems matter to your website.',
        'UptimeRobot documents HTTP monitoring based on response statuses and keyword monitoring for page content. Its API monitoring also supports assertions on response fields, headers, status codes, and bodies. It would be inaccurate to describe every uptime product as checking only whether a server answers.',
      ], sourceIds: [1, 2] },
      { id: 'fixflags-fit', title: 'What FixFlags helps with', paragraphs: [
        'FixFlags checks supported public pages and actions for problems such as broken links, slow loading, and steps that lead nowhere. It keeps the details together and gives you instructions to help fix what it finds.',
        'Read the coverage page before relying on a particular check. Public-page results do not confirm every private task or account permission. More specialized checks may still be useful for your app.',
      ], sourceIds: [0] },
      { id: 'selection', title: 'Try an important page first', paragraphs: [
        'Pick a page your visitors use often. Write down what should happen after its main button is selected. Try a check and see whether its result answers that question. Look for enough detail to understand what went wrong.',
        'Also look at how often checks run, what happens when a page is blocked, and how you’ll hear about problems. A low price is not useful if the service does not check the thing you need.',
      ] },
      { id: 'operate', title: 'Know what each check tells you', paragraphs: [
        'Keep useful checks you already have. A page being online can help explain a problem, but it does not prove a broken cart has been fixed. After publishing a fix, repeat the original step for independent verification.',
        'In FixFlags, Couldn’t verify means the result could not be confirmed. Scheduled checks leave time between runs. Read current pricing and coverage before relying on features marked coming soon.',
      ] },
    ],
    example: { title: 'The product page opens, but the cart does not update', paragraphs: [
      'In this controlled illustration, a demo product page opens successfully and shows the expected product name. A check for availability or that name can pass while Add to cart still fails.',
      'A new check needs to find the product in the cart to confirm the cart fix. Checkout is a separate step. This example is not a comparison of provider speed, cost, or reliability.',
    ] }, sources: [coverage, uptime, api], related: ['website-online-but-not-working', 'fixflags-vs-scripted-browser-monitoring'],
  },
  {
    slug: 'fixflags-vs-scripted-browser-monitoring',
    title: 'Do you need to write your own website tests?',
    description: 'Start with public website checks, and know when a custom test could help.',
    decision: 'Use FixFlags for the public pages it supports. Consider a custom test for a specific private task outside that coverage.',
    sections: [
      { id: 'scripted-checks', title: 'What a custom test does', paragraphs: [
        'A custom browser test spells out the pages to open, buttons to select, and results to expect. Checkly documents Playwright browser checks with page interactions, assertions, retained execution results, and alerts. This can help a team check a task with very specific requirements.',
        'Someone needs to write and look after the test as the website changes. The test must check the actual result. Selecting Send is not enough to show a message arrived. Test accounts and data also need safe setup and cleanup.',
      ], sourceIds: [1] },
      { id: 'supported-coverage', title: 'Start without writing a script', paragraphs: [
        'For supported public pages, FixFlags starts with your website address. It checks for problems and gives you fix instructions to copy and paste. Each result tells you which pages and actions it checked.',
        'That does not cover every private task your app might have. Read the coverage details for signup and other steps with special requirements. Keep a separate review for important tasks outside those checks.',
      ], sourceIds: [0] },
      { id: 'choose-path', title: 'Choose what fits your website', paragraphs: [
        'If you need a precise sequence inside a private account, a custom test may be useful. Confirm that it has permission to use the account, does not change real customer data, and cleans up any test data it creates.',
        'If you want to find problems on supported public pages and get help fixing them, try FixFlags with an important page first. You can use both approaches when they answer different questions.',
      ] },
      { id: 'verification', title: 'Check that the live fix worked', paragraphs: [
        'Whichever approach you use, publish the fix and check the original problem again. This is independent verification. Changing a test so it skips a broken step can hide the problem instead of fixing it.',
        'In FixFlags, a blocked or unfinished check stays Couldn’t verify. Results apply to what was checked at that time. Keep reviewing important steps that are outside the available checks, and remember there is time between scheduled runs.',
      ] },
    ],
    example: { title: 'A public signup link and a private approval step', paragraphs: [
      'In this controlled illustration, a demo app has a public signup button and an approval form inside a private account. They need different checks.',
      'A public check can confirm where the signup button leads. The private approval step needs its own authorized test, safe test data, and a way to clean up. Passing one does not prove the other works.',
    ] }, sources: [coverage, checkly], related: ['fixflags-vs-uptime-monitoring', 'monitoring-ai-built-websites'],
  },
  {
    slug: 'checkout-broken-after-deploy',
    title: 'Checkout broke after a deploy. What now?',
    description: 'The usual reasons checkout stops working right after you ship, and how to confirm the fix on your live site.',
    decision: 'Reproduce it on the live site first, then compare what changed between your preview and production.',
    reviewedAt: '2026-11-10',
    sections: [
      { id: 'reproduce', title: 'Reproduce it on the live site', paragraphs: [
        'Open the product page your customers use, not a preview. Add an item, open the cart, and continue to checkout. Stop before entering payment details or placing an order. Write down the exact step where it fails and what you see: an error message, a button that does nothing, or a page that never loads.',
        'Open the browser developer tools and look at the console and network tabs while you repeat the step. A failed request to your own server or to the payment provider usually points straight at the cause.',
      ] },
      { id: 'keys-and-modes', title: 'Check keys and environment settings', paragraphs: [
        'The most common cause after a deploy is configuration, not code. Payment providers such as Stripe keep separate keys for testing and for live payments, and objects created in one mode are not visible in the other. A production build that picked up a test key, an empty environment variable, or a key that was rotated will fail even though the code is unchanged.',
        'Compare the environment variables your host uses for production with the ones your preview used. Check that the publishable key in the page and the secret key on the server come from the same mode and the same account.',
      ], sourceIds: [1] },
      { id: 'urls-and-webhooks', title: 'Check addresses and webhooks', paragraphs: [
        'Checkout often depends on addresses that change between environments: the page customers return to after paying, and the endpoint that receives payment events. If those still point at a preview domain, or the webhook endpoint was not registered for the production address, orders can look broken after payment even when the payment went through.',
        'Webhook endpoints are registered at a public HTTPS address, and each endpoint has its own signing secret. A redirect on that address counts as a failed delivery. After a domain or host change, confirm the endpoint address and its secret.',
      ], sourceIds: [2] },
      { id: 'fix-and-verify', title: 'Fix it, then prove it on the live site', paragraphs: [
        'Give your AI tool or developer the exact failing step, the error, and what should happen instead. Review the change, publish it, then check the same step again on the live site. FixFlags can reach checkout from the product page without paying, record where it stops, and run the same check again after your fix as independent verification.',
        'If a check cannot reach the step, for example because the page is blocked, the result is Couldn’t verify rather than fixed. Keep the problem open until a check confirms checkout opens again, and add a check after every deploy so the next regression is caught before customers find it.',
      ], sourceIds: [0] },
    ],
    example: { title: 'A checkout that broke on the live site only', paragraphs: [
      'In this controlled illustration, a demo store works in its preview. After publishing, the product page loads, but selecting checkout returns an error because the production build is missing a payment key.',
      'After the key is set and the site is published again, a new check reaches checkout from the product page. No payment or order is made, so the check confirms checkout opens, not that payments settle.',
    ] }, sources: [coverage, stripeKeys, stripeWebhooks], related: ['website-online-but-not-working', 'checking-after-publishing'],
  },
  {
    slug: 'ai-built-site-launch-checklist',
    title: 'A launch checklist for websites built with AI',
    description: 'What to check on the live site before you share a website you built with Lovable, Bolt, v0, Replit or a coding agent.',
    decision: 'Check the published address on a phone and a laptop, follow every main button once, then set up checks for what comes next.',
    reviewedAt: '2026-11-10',
    sections: [
      { id: 'publish', title: 'Check the published site, not the preview', paragraphs: [
        'AI builders show a preview while you work. Visitors see the published version, which can differ: a change you made after publishing is not live until you publish again, and settings such as your domain and environment values belong to the published site. Open the address you will share, on the device your visitors use most.',
        'Make sure the address loads over HTTPS with your own domain if you have one, and that the page title and link preview look right when you paste the link into a message.',
      ], sourceIds: [1] },
      { id: 'buttons-and-pages', title: 'Follow every main button once', paragraphs: [
        'Generated sites often include buttons and links that were placeholders when the page was created: a pricing link to a page that does not exist, a sign-up button with nothing behind it, a footer full of links to nowhere. Select each main button and menu item and see where it goes.',
        'Look for leftover sample text, such as Lorem ipsum or Your company name, and for pages that load blank. These are easy to miss when you only look at the page you were editing.',
      ] },
      { id: 'phones-and-forms', title: 'Try it on a phone and submit a form', paragraphs: [
        'Open the menu on a phone. Check that popups and banners do not cover the main button, that text is readable without zooming, and that forms show a clear message after you submit them. Use a test entry rather than real customer details.',
        'If you take payments or sign-ups, go as far as you safely can: open the cart and checkout, or start the sign-up flow, and stop before paying or creating a real account unless you have a safe test setup.',
      ] },
      { id: 'after-launch', title: 'Keep checking after launch', paragraphs: [
        'Every new prompt can change more than you asked for. FixFlags checks the published site in a real browser, hands your AI tool fix instructions for anything broken, and checks the same page again after you publish the fix as independent verification. A check that cannot reach a page reports Couldn’t verify rather than guessing.',
        'Save the website to keep scheduled checks running, and send a check after each deploy so a regression shows up before your visitors find it.',
      ], sourceIds: [0] },
    ],
    example: { title: 'A pricing link that only worked in the preview', paragraphs: [
      'In this controlled illustration, a demo site built with an AI tool has a pricing button that works in the preview. The published site still points at a page that was renamed, so the button opens a not found page.',
      'The fix instructions name the page, the button and the expected result. After the change is published, a new check opens the pricing page from the homepage button.',
    ] }, sources: [coverage, lovable], related: ['monitoring-ai-built-websites', 'checking-after-publishing'],
  },
  {
    slug: 'fixflags-vs-lighthouse',
    title: 'FixFlags or Lighthouse and PageSpeed Insights?',
    description: 'What a page score tells you, what it leaves out, and when you need both.',
    decision: 'Use Lighthouse to tune one page you are working on. Use FixFlags to find what is broken across the live site and prove a fix worked.',
    reviewedAt: '2026-11-10',
    sections: [
      { id: 'what-lighthouse-does', title: 'What Lighthouse and PageSpeed Insights do well', paragraphs: [
        'Lighthouse audits one page per run for performance, accessibility, search basics and good practices. You can run it in Chrome DevTools, from the command line, or through PageSpeed Insights. It is free, well documented, and the right tool when you are tuning a specific page.',
        'PageSpeed Insights adds field data from real Chrome users when a page has enough traffic, next to the Lighthouse lab result, for mobile and desktop. That makes it a good reference for how fast a page feels to real visitors.',
      ], sourceIds: [1, 2] },
      { id: 'what-a-score-leaves-out', title: 'What a page score leaves out', paragraphs: [
        'A score describes the page it was given. It does not follow your pricing link, add a product to the cart, open the menu on a phone and try the next page, or notice that a button now leads to a page that does not exist. A fast page can still have a checkout that fails.',
        'Scores also move between runs because the test conditions change. That is fine for tuning, but a score going up after a deploy does not prove that a specific problem is gone.',
      ] },
      { id: 'what-fixflags-adds', title: 'What FixFlags adds', paragraphs: [
        'FixFlags checks the live website in a real browser and follows what visitors do: the main buttons, key pages, forms and the cart where it can do so safely. It still measures speed, but a broken action ranks above a slow image. Each problem becomes a Flag with the page, what happened, what should happen and the evidence, plus fix instructions for the AI tool you build with.',
        'After you publish a fix, FixFlags checks the same page and action again as independent verification. If it cannot reach them, the result is Couldn’t verify, not fixed.',
      ], sourceIds: [0] },
      { id: 'use-both', title: 'When to use each', paragraphs: [
        'Use Lighthouse or PageSpeed Insights while you work on one page and want detailed performance advice. Use FixFlags to check the whole live site after you publish, to hand your AI tool a specific fix, and to keep watching after launch. Many teams use both: FixFlags tells you which page and action broke, and Lighthouse helps you tune that page.',
      ] },
    ],
    example: { title: 'A good score and a broken signup', paragraphs: [
      'In this controlled illustration, a demo homepage scores well for performance. Its signup button points at a page that was removed in the last update, so visitors who select it land on a not found page.',
      'A page score for the homepage does not show this. A FixFlags check follows the button, flags the missing page with the evidence, and confirms the fix after the link is corrected and published.',
    ] }, sources: [coverage, lighthouse, pagespeed], related: ['fixflags-vs-uptime-monitoring', 'website-online-but-not-working'],
  },
]

export function getWebsiteGuide(slug: string) {
  return WEBSITE_GUIDES.find(guide => guide.slug === slug)
}
