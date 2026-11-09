import { PUBLIC_OFFER } from './public-offer'
import type { WebsiteGuideSlug } from '@/lib/analytics/guide-entry'

export const GUIDE_REVIEWED_AT = '2026-10-20'

export const GUIDES_PAGE = {
  eyebrow: 'Website guides',
  title: 'A little help looking after your website.',
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
]

export function getWebsiteGuide(slug: string) {
  return WEBSITE_GUIDES.find(guide => guide.slug === slug)
}
