import type { DocsPageKey } from '@/lib/docs/catalog'

export interface BlogCover {
  src: string
  width: number
  height: number
  alt: string
}

export interface BlogPost {
  slug: string
  title: string
  seoTitle: string
  date: string
  publishedAt?: string
  updatedAt?: string
  dateNote?: string
  category: string
  excerpt: string
  cover: BlogCover
  body: readonly string[]
  sections: readonly { id: string; title: string; paragraphs: readonly string[] }[]
  relatedDocs: readonly DocsPageKey[]
}

export const BLOG_SERIES_COVER: BlogCover = {
  src: '/marketing/blog/website-quality-cover-v2.webp',
  width: 1600,
  height: 800,
  alt: 'Builders pass pale browser panels through a dark inspection frame with an orange flag. The FixFlags logo appears in the lower-right corner.',
}

export const BLOG_PAGE = {
  label: 'Blog',
  headline: 'A few things worth checking.',
  body: 'Why we built FixFlags, what to check before you share a website, and how to know a fix worked.',
  seriesLabel: 'The FixFlags notes',
  readArticle: 'Read article',
  guideTitle: 'Try it on your own website',
  guideBody: 'Enter a public URL and see what FixFlags can check. If it finds a problem, open the Flag and take a look at what happened.',
  startCta: 'Check your website',
  docsCta: 'Read the docs',
  guidesCta: 'Explore website guides',
  back: 'Back to blog',
  onThisPage: 'In this article',
  relatedTitle: 'If you want to try this',
  updatedLabel: 'Updated',
  readingProgress: 'Article reading progress',
  nextArticle: 'Read the next article',
  readingTime: (minutes: number) => `${minutes} min read`,
} as const

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'introducing-fixflags',
    title: 'Introducing FixFlags: a second pair of eyes for your website',
    seoTitle: 'Introducing FixFlags: website quality checks for busy builders',
    date: '2026-06-10',
    publishedAt: '2026-10-11',
    updatedAt: '2026-10-11',
    dateNote: 'We started building what became FixFlags on June 10, 2026. This founding note was written on October 11, 2026.',
    category: 'Why we built it',
    excerpt: 'AI helps us build more software. FixFlags helps with the question that comes next: is the website actually working for the people using it?',
    cover: BLOG_SERIES_COVER,
    body: [
      'AI has made it easier to turn an idea into something people can use. You can try a feature, change the design, and get a website online without writing every line yourself. That has opened the door to people who might never have built software before.',
      'It also leaves a familiar job waiting for you. Someone still has to check the website. Can a visitor find what they need? Does the form work? Can they get to checkout? Is the page slow on a phone? Did you set up the tracking you need?',
      'When you’re a solo founder, that someone is usually you. But you’re also building the next feature, answering messages, and trying to keep the business going. FixFlags started with that problem in mind.',
    ],
    sections: [
      {
        id: 'who-checks-the-work', title: 'Who checks the work while you keep building?',
        paragraphs: [
          'On a larger team, a QA analyst, product owner, or another developer might spend time checking a release. They ask the awkward questions, try the less obvious paths, and notice when something doesn’t match what a customer expects.',
          'A solo founder often has to fit that work around everything else. A small team might be running several products at once. Even when someone owns quality, there are still more pages and changes than they can keep checking by hand.',
          'Building faster doesn’t give you more hours to review what you’ve built. We wanted a way to keep an eye on the live website while its owner gets on with the rest of the work.',
        ],
      },
      {
        id: 'vibe-coding-and-website-quality', title: 'Vibe coding can get you started. There’s still a lot to learn.',
        paragraphs: [
          'If you started building through vibe coding, you may have gone from describing an idea to publishing a working page very quickly. You might not have had someone show you how to check page speed, find an inaccessible form, or make sure a signup is being counted in your analytics.',
          'Those are things people learn with practice. They’re easy to overlook on a first website, especially when the page looks good and the AI says the work is done.',
          'When we talk about AI slop here, we mean the unfinished bits people end up using: placeholder copy, links that go nowhere, forms that give no answer, and pages that look ready but haven’t been checked. The same problems can turn up in websites written entirely by hand.',
          'You should be able to understand what needs attention without first becoming an expert in every part of website quality. A useful check points to a specific problem, explains why it matters, and gives you somewhere to start.',
        ],
      },
      {
        id: 'beyond-a-basic-uptime-check', title: 'A website can be online and still be hard to use',
        paragraphs: [
          'A basic uptime check tells you whether a URL responds. That’s useful. A website that’s down needs attention.',
          'But a page can respond while the checkout button does nothing. A contact form can open without ever showing a confirmation. The site can load on your laptop and still feel slow on someone’s phone. Your analytics can be connected while an important action goes uncounted.',
          'Website monitoring needs to look at the things people came to do, as well as whether the server answered. That’s the part of the problem we want FixFlags to help with.',
        ],
      },
      {
        id: 'what-fixflags-does', title: 'What FixFlags is here to do',
        paragraphs: [
          'FixFlags checks the live website and brings what it finds into one Site. You can see the areas it checked, when it checked them, and where it couldn’t get enough information.',
          'When a problem needs attention, you get a Flag with the affected page, what happened, and guidance for the fix. After you publish a change, Verify checks the relevant behavior again. Copying a suggestion or finishing a deployment doesn’t close the Flag on its own.',
          'You can also add a monitoring schedule for your Site. Shopify, Google Analytics, and Google Search Console connections are coming soon. Their planned context is described separately from the website checks available today.',
          'The limits matter. A checkout-entry check stops before payment. Traffic numbers don’t prove a form works. A page blocked by a password or bot challenge hasn’t passed a check. We want those gaps to be visible, so you know what still needs a look.',
        ],
      },
      {
        id: 'for-more-than-ai-built-websites', title: 'This is useful even if AI never wrote your website',
        paragraphs: [
          'An established company website can break after a content edit. A store can change when a theme or app is updated. An agency can hand over a site that needs to keep working after the project is finished.',
          'Whether you built it by hand, with an AI coding tool, or in a website builder, the question is the same. Can the next visitor do what they came to do?',
          'We started building what became FixFlags on June 10, 2026 because we wanted help answering that question. More people can build software now. They deserve a clear way to check it, too.',
        ],
      },
    ],
    relatedDocs: ['getting-started', 'site-care', 'integrations'],
  },
  {
    slug: 'why-ai-built-sites-need-a-launch-check',
    title: 'Your AI-built website looks finished. Does it work?',
    seoTitle: 'AI website checks: what to review before launch | FixFlags',
    date: '2026-07-02',
    updatedAt: '2026-10-11',
    category: 'Before you share the link',
    excerpt: 'Before you share the URL, try the links, forms, and buying paths a visitor will use. A good-looking page can still have a few unfinished parts.',
    cover: BLOG_SERIES_COVER,
    body: [
      'You’ve got a homepage, the layout looks good, and the AI has finished its changes. It’s tempting to share the link and move on. Take a few minutes to use the website first.',
      'Start with the reason someone would visit it. They might want to buy something, book a call, leave a message, or try your app. Follow that path on the live site and see where it takes you.',
    ],
    sections: [
      {
        id: 'follow-the-main-action', title: 'Try the main button',
        paragraphs: [
          'Click the main call to action. Does it open the right page? If it leads to a form, do the fields have clear labels? Does the form tell you what happened after you use it? Look for links to placeholders and error messages that leave someone stuck.',
          'For a store, try a product that’s available to buy and follow it through the cart to checkout entry. Stop before payment. If testing a form would send a message or create a record, use a test setup you’re allowed to use and know how to clean up afterward.',
          'Give it a try on a narrow screen, too. A button that works on your laptop might be hidden behind something on a phone.',
        ],
      },
      {
        id: 'review-the-supporting-pages', title: 'Look at the pages around it',
        paragraphs: [
          'Open the pricing page as if you’ve never seen the product before. Can you tell what you get, what it costs, and whether you can use it today? Try the integration links and check that they lead to setup instructions.',
          'Go through the footer. Make sure Help and Contact lead somewhere useful. If the site has a blog, it should be easy to find, and its articles should give the reader more than a few paragraphs of sales copy.',
          'These pages don’t always get the same attention as the homepage. They still help someone decide whether to trust the website.',
        ],
      },
      {
        id: 'read-the-evidence', title: 'Ask what was actually checked',
        paragraphs: [
          'If a tool reports a problem, look for the page it happened on and what the tool saw. A screenshot is useful when it shows the right moment. A general score doesn’t always tell you which change to make.',
          'If it reports no problems, check the coverage. Did it open the page? Did it try the action? Was something blocked or skipped? A result without those details can leave you guessing.',
        ],
      },
      {
        id: 'verify-and-keep-watching', title: 'Check again after the fix',
        paragraphs: [
          'Publish the change, then go back to the same page and try the same action. Seeing the code change isn’t enough to know the live problem is gone.',
          'In FixFlags, that’s what Verify is for. Start with a public URL, look at the Flags, and check the affected behavior again after you fix it. If you want to keep checking it later, save your Site and set up monitoring. The schedule only covers the pages and actions configured for that Site.',
        ],
      },
    ],
    relatedDocs: ['getting-started', 'site-care', 'integrations'],
  },
  {
    slug: 'a-deployment-is-not-proof-the-website-works',
    title: 'Your deployment passed. Check the website, too.',
    seoTitle: 'Check your live website after deployment | FixFlags',
    date: '2026-10-11',
    category: 'After you publish',
    excerpt: 'A successful deployment means the release finished. Try the customer’s path on the live website to find out whether the change worked.',
    cover: BLOG_SERIES_COVER,
    body: [
      'The deployment is green. That’s good news. Now open the website and try the thing you changed.',
      'A release can finish while a form stays broken or a product still won’t reach checkout. The build can’t tell you everything that happens when someone uses the live page.',
    ],
    sections: [
      {
        id: 'define-the-success-condition', title: 'Decide what working should look like',
        paragraphs: [
          'Be specific about the result you expect. A fixed link should open the right destination. A product should enter the cart and reach checkout. A form should show the result the visitor was told to expect.',
          'Keep the claim as small as the check. Reaching checkout entry doesn’t prove a payment will go through. Testing one product doesn’t tell you about every product and variant.',
        ],
      },
      {
        id: 'compare-the-same-behavior', title: 'Go back to the path that failed',
        paragraphs: [
          'Use the page and action where the problem showed up. Keep the new result with the original finding, so the person reviewing the fix can see what changed.',
          'If a password gate, bot challenge, or timeout stops the check, say so. You don’t have enough information yet. In FixFlags, that stays a result we couldn’t verify, rather than closing the Flag.',
        ],
      },
      {
        id: 'keep-context-separate-from-proof', title: 'Use the numbers to help you decide what matters',
        paragraphs: [
          'Traffic and search data can tell you which pages people use. Deployment history can help you work out when a problem began. You still need to try the affected action to know whether it works.',
          'FixFlags uses connected data as context beside its checks. Verify looks for a fresh result on the relevant page or path. An AI coding tool saying the fix is done doesn’t settle that question.',
        ],
      },
      {
        id: 'watch-after-verification', title: 'Keep checking the things you depend on',
        paragraphs: [
          'Today’s check tells you about today. A later edit, an updated plugin, or an outside service can change what happens tomorrow.',
          'Set up monitoring for the pages and actions you want to keep an eye on. In FixFlags, check that the schedule has been saved and that you can see the next planned check. Read the coverage, too, so you know what the schedule includes.',
        ],
      },
    ],
    relatedDocs: ['site-care', 'troubleshooting', 'shopify'],
  },
]

export function blogReadingMinutes(post: BlogPost) {
  const text = [...post.body, ...post.sections.flatMap(section => [section.title, ...section.paragraphs])].join(' ')
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200))
}

export function blogDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}
