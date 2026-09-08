# FixFlags Product Vision

**Accepted direction: 2026-09-08. Status: VISION, not a shipped-capability claim.**

This is the complete owner-supplied revision, recorded from the September 8 attachment titled “FixFlags Product Vision Your website, looked after.” It supersedes the September 7 Site Intelligence draft and earlier Product Review, Finish Plan, AI-built-software, two-product, and Shopify-only positioning. The brand remains FixFlags. The report experience is being replaced; useful foundations, accounts, billing, and plans remain available for reuse.

The owner's text below is preserved in full; headings are formatted for navigation. Example numbers, cadences, connections, and scenarios illustrate the target experience. They do not define current entitlements or claim that capabilities ship today. [Implementation phases](../ROADMAP.md), [build requirements](../docs/product-prd.md), and [current implementation](../PRODUCT.md) have separate roles.

---

Your website, looked after.
FixFlags is the system a business connects to its website once and trusts to notice when something needs attention.
Give FixFlags a URL.
It learns what the website is, what people need to be able to do on it, and what the business depends on. It checks the site from the outside, verifies important journeys in a real browser, learns from real usage when connected, adds context from systems such as Shopify, Analytics, Search Console, Meta, and deployments, and keeps watching over time.
When something matters, FixFlags raises a Flag.
A Flag explains what happened, why it matters, what evidence supports it, what should happen next, and whether the problem was actually fixed.
When everything important is healthy, FixFlags stays quiet.
The promise is simple:
FixFlags tells you how your website is doing, what needs attention, and keeps watching.

## 1. The problem
Websites are now essential business infrastructure, but understanding whether a website is truly healthy is fragmented.
One tool says the server is online.
Another finds SEO problems.
Another measures performance.
Another checks accessibility.
Another contains analytics.
Another knows advertising traffic.
Another knows orders.
Another knows deployments.
And none of them is simply responsible for answering:
Is my website doing what it needs to do?

A website can be online and still be broken.
A store can load while Add to Cart does nothing.
A signup page can look perfect while submissions fail.
A buying journey can work while Meta stops receiving conversion events.
A site can be fast while Google cannot properly index important pages.
A technical issue can exist on an irrelevant page, while a seemingly small problem can affect the destination of the company's largest campaign.
Website owners should not have to assemble these signals themselves.
FixFlags does that work.
## 2. The product
FixFlags is not a collection of website tools.
It is one system with many ways of understanding a website.
It may check:
- availability
- broken links and pages
- forms and interactions
- important customer journeys
- mobile behavior
- performance
- accessibility
- search fundamentals
- crawlability
- structured data
- tracking
- analytics technology
- commerce behavior
- deployments and changes
- real visitor failures
- paid traffic exposure
But these are capabilities inside FixFlags, not separate products.
The customer should never need to think:
“Should I run an SEO audit or a funnel test?”

They should be able to ask:
How is my website doing?

And FixFlags should know how to answer.
## 3. The permanent object is the Site
A customer does not create a scan.
They add a Site.
The Site persists.
A first analysis is simply the beginning of its history.
Over time FixFlags learns:
- what exists
- what matters
- how the site is structured
- what people are trying to accomplish
- which pages belong together
- what technologies the site depends on
- what normal looks like
- what has changed
- what has failed before
- what traffic depends on
- what FixFlags can and cannot verify
The product becomes more useful because the Site becomes better understood.
A URL becomes a living model of the website.
## 4. FixFlags learns what the website is for
The most important thing FixFlags can understand is not the page count.
It is:
What must people be able to do here?

We call these Outcomes.
For a store:
Buy
Product → Add to cart → Cart → Checkout → Purchase

For a SaaS business:
Sign up
Pricing → Signup → Account created

For a local business:
Get in touch
Service page → Contact → Submit → Confirmation

For a nonprofit:
Donate
Campaign → Donation → Confirmation

For a restaurant:
Book
Restaurant → Reservation → Confirmation

FixFlags should infer these automatically whenever possible.
Then the product asks for the smallest useful confirmation:
We think these are the important things people need to be able to do.
Buy
Contact
Looks right · Edit

This is not a funnel builder.
It is FixFlags confirming that it understands what success means.
## 5. Pages belong to the Site. Outcomes give them meaning.
Pages should not become a separate product from journeys or funnels.
A page is simply a place on the Site.
An Outcome describes how pages and actions work together toward something important.
For example:
/products/classic-chair
Part of Buy
Shopify product: Classic Chair
Receives traffic from 3 active campaigns
1 open Flag
Last verified 14 minutes ago
A page may belong to several Outcomes.
Some pages may belong to none.
FixFlags can still watch them for availability, search health, performance, accessibility, tracking, and other issues.
The model remains simple:
Site → Pages and actions → Outcomes

## 6. Flags are the universal unit of attention
A check is not a Flag.
An observation is not a Flag.
A warning from another system is not automatically a Flag.
A Flag is something FixFlags believes deserves attention.
That distinction is fundamental.
FixFlags may run hundreds of checks and produce no important Flags.
That is a successful result.
Every Flag should answer six questions.
What happened?
Customers cannot add one product variant to cart on mobile.

Where?
Classic Chair · Purchase outcome

How sure are we?
Confirmed twice.

Why does it matter?
It prevents customers from reaching checkout.

What proves it?
Screenshot, replay, network evidence, telemetry, external data, or other relevant evidence.
What happens next?
Fix this

And after the change:
Verify fix

A problem should not become resolved because somebody clicked “Done.”
It becomes resolved when FixFlags can establish that the behavior works again.
## 7. FixFlags separates truth from inference
Trust is more valuable than issue count.
FixFlags should be precise about what it knows.
A useful finding can be:
Confirmed
FixFlags has sufficient evidence that something is wrong.
Likely
The evidence strongly suggests a problem, but FixFlags cannot yet prove the entire failure.
Couldn't verify
FixFlags attempted the check but could not establish a reliable answer.
Healthy
A specific behavior passed the latest relevant check.
The product should never turn uncertainty into certainty merely because certainty sounds better.
AI may help FixFlags reason.
It must not manufacture truth.
## 8. Checks are infrastructure, not navigation
FixFlags should eventually know how to perform a very large number of checks.
That complexity belongs underneath the product.
For search and discovery, for example, FixFlags might inspect:
- sitemap health
- robots.txt
- indexability
- canonicalization
- metadata
- structured data
- internal links
- redirect behavior
- crawlability
- Search Console signals
- relevant machine-readable standards
For experience:
- responsiveness
- Core Web Vitals
- performance
- accessibility
- interaction failures
- layout problems
- mobile behavior
For measurement:
- analytics presence
- expected tags
- Meta events
- Google events
- TikTok events
- tag disappearance
- duplicate instrumentation
- missing conversion events
For reliability:
- uptime
- page failures
- SSL
- failed requests
- runtime errors
- forms
- APIs used by important experiences
The customer does not need a screen containing 400 checkboxes.
FixFlags turns checks into understanding.
Checks create evidence.
Flags create attention.

## 9. Outcomes are more important than scores
FixFlags should resist turning website health into one giant number.
A 76/100 may look clean, but it hides the most important distinction:
What actually needs me?

A website with a hundred small technical imperfections may be healthier than a 95/100 website whose checkout stopped working.
The primary state should therefore be human:
🟢 Everything important we're watching is healthy

or:
🔴 2 things need attention

Scores can exist where they help explain a specific area.
They should never become the product.
## 10. Coverage makes “everything is healthy” trustworthy
FixFlags must be explicit about the scope of its knowledge.
A healthy state should never imply omniscience.
The Site should quietly communicate Coverage:
Watching
Website availability · continuously
Buy · mobile + desktop · every hour
Contact · every hour
42 public pages · daily
Search fundamentals · daily

And when there is useful context FixFlags does not yet have:
Could know more
Purchase outcomes · Connect Shopify
Real visitor behavior · Add FixFlags
Search performance · Connect Search Console

This gives “healthy” a concrete meaning.
It also gives integrations a natural reason to exist.
## 11. The product starts with a URL
The first experience should be almost frictionless.
The homepage asks:
Your website, looked after.
yourwebsite.com
Check my website
No installation.
Ideally no account before the first useful result.
FixFlags begins understanding the Site.
Instead of a generic loading screen, the product can reveal what it learns:
Website reachable ✓
Shopify detected ✓
42 pages discovered
Purchase behavior detected
Contact form found
Meta Pixel detected
Checking mobile experience…
Testing Purchase…

The user sees FixFlags building an understanding of their website, not running a generic audit.
## 12. The first analysis becomes the dashboard
There should be no disposable report followed by a different product.
The first analysis simply becomes the Site.
For example:
acme.com
🟢 Live
42 pages · 2 important Outcomes
Last checked 3 minutes ago
Needs attention
🔴 Customers can't add one product variant to cart
Confirmed twice · Buy
View Flag
🟠 Meta AddToCart is not firing
Buying still works · Measurement
View Flag
What we're watching
🟢 Buy
Working
🟢 Contact
Working
🟠 Get discovered
3 things worth reviewing
Add more context
Shopify detected
Connect Shopify so FixFlags can confirm products and real purchase outcomes.
Connect
That is already the product.
## 13. Saving the Site is the conversion
The primary call to action after the first useful analysis should not feel like SaaS registration.
It should feel like the obvious continuation of something already useful:
Keep watching

Saving the Site creates the account and preserves its history.
Then:
You're covered.
FixFlags will keep checking this Site and let you know when something deserves attention.

The account exists because the customer has chosen ongoing responsibility.
## 14. Connections make existing answers better
FixFlags should never become an integrations marketplace.
Connections only matter when they improve something FixFlags already understands.
Shopify
Without Shopify:
Add to Cart is failing.

With Shopify:
The problem affects 17 active products, including your highest-selling product.

Analytics
Without Analytics:
Signup is failing.

With Analytics:
1,840 visitors reached this step yesterday.

Meta
Without Meta:
This landing page is broken.

With Meta:
Four active campaigns are currently sending paid traffic here.

Search Console
Without Search Console:
These pages have search problems.

With Search Console:
These affected pages currently receive 38% of organic clicks.

Deployment source
Without deployment context:
Checkout began failing this morning.

With deployment context:
The failure first appeared 11 minutes after today's release.

Connections do not create new FixFlags products.
They make the same Site, Outcome, Page, and Flag more intelligent.
## 15. Ask for context only when its value is obvious
There should be no onboarding checklist filled with logos.
FixFlags should work first.
Then ask.
Inside a Purchase Outcome:
Confirm real purchase outcomes
Shopify detected. Connect it so FixFlags can compare our checks with what actually reaches purchase.

Inside a search problem:
Add real search impact
Connect Search Console to see how much Google traffic these pages receive.

Inside a campaign landing page:
Add paid traffic context
Connect Meta to see whether active campaigns currently depend on this page.

The user should never have to wonder:
“Why am I connecting this?”

## 16. FixFlags has three sources of truth
Internally, the system remains conceptually simple.
Verify
What FixFlags can establish itself.
FixFlags can crawl, inspect, open pages, use a real browser, click, select, submit safe forms, walk Outcomes, inspect requests, test expected tracking, capture evidence, retry failures, and rerun checks after fixes.
This is our independent evidence layer.
Observe
What is actually happening for real visitors.
A lightweight FixFlags observer can collect only the signals needed to understand website health:
- important page usage
- Outcome progression
- runtime failures
- failed requests
- real-user performance
- expected measurement signals
FixFlags should not become another general-purpose analytics platform.
Observation exists to improve website health decisions.
Connect
What other trusted systems know.
Examples:
Shopify → commerce context
Analytics → behavioral context
Search Console → search context
Meta → paid-demand context
GitHub/Vercel → change context
Different evidence.
One Site.
## 17. Intelligence decides what matters
The challenge is not finding more imperfections.
The challenge is deciding which ones deserve attention.
FixFlags should reason about:
Certainty
How strong is the evidence?
Impact
What has actually stopped working?
Outcome
Does the problem affect something the business depends on?
Exposure
How many pages, visitors, products, or sessions encounter it?
Business context
Is revenue, paid traffic, search traffic, or another important source attached to it?
Change
Did it begin after a deployment, theme update, integration change, or other event?
Persistence
Was this transient or does it keep happening?
These signals determine priority.
The goal is not:
Find more Flags.

It is:
Make every Flag worth the customer's attention.

## 18. AI is the intelligence layer, not the truth layer
FixFlags should use deterministic systems wherever deterministic answers are available.
HTTP behavior.
Sitemaps.
Browser errors.
Network requests.
Structured data.
Accessibility rules.
Performance measurements.
Tracking events.
Browser outcomes.
Connected data.
These provide evidence.
AI is valuable for things computers traditionally struggle with:
- understanding what the business is
- inferring important Outcomes
- understanding page relationships
- recognizing unusual behavior
- connecting several symptoms
- judging likely importance
- selecting useful follow-up checks
- explaining problems clearly
- producing implementation guidance
The principle is:
Use machines to prove what can be proved.
Use intelligence to understand what the evidence means.

## 19. One Flag serves every level of user
FixFlags should not have a beginner product and a professional product.
The same information should progressively reveal more depth.
A founder sees:
Customers cannot checkout on mobile.

A marketer can expand:
4 active campaigns send traffic through this Outcome.

A developer can expand:
POST /cart/add.js returned 422 after variant selection.

An agent can receive:
- URL
- viewport
- reproduction sequence
- screenshots
- browser state
- network evidence
- relevant DOM context
- expected result
- verification criteria
One Flag.
Different depth.
Complexity is available without being imposed.
## 20. Fixing belongs inside FixFlags
Finding the problem is only half the job.
Every actionable Flag should lead naturally to:
Fix this
The available routes can depend on the user.
Send to my AI
Copy or send the complete problem context to a coding agent.
Share
Send a clean Flag to the person responsible for the Site.
View technical details
Expose the evidence required to investigate manually.
Once a fix has been made:
Verify fix

FixFlags reruns the relevant behavior.
If it passes:
✓ Resolved
Fix verified 3 minutes ago.

This is the core operating loop:
Find → Understand → Fix → Verify

Monitoring simply keeps the loop running.
## 21. History turns monitoring into understanding
As FixFlags watches a Site, the question changes from:
What is wrong?

to:
What changed?

FixFlags should build a useful history of:
- deployments
- theme changes
- content changes
- newly discovered pages
- removed pages
- performance regressions
- tracking changes
- new Flags
- recoveries
- integration changes
Eventually FixFlags can connect them:
Checkout began failing 12 minutes after this deployment.

Or:
Structured data disappeared from 46 product pages after yesterday's theme update.

Or:
Performance recovered after this release.

History gives the Site memory.
Memory improves diagnosis.
## 22. The interface should remain tiny
The underlying system can become extraordinarily sophisticated.
The interface should not.
FixFlags should be designed mobile-first.
The primary navigation can remain as small as:
Home · Flags · Site
Home
Does anything need me?

Important status, important Outcomes, open Flags, meaningful recent changes.
Flags
What needs fixing?

The prioritized list of things worth attention.
Site
What is FixFlags responsible for?

Outcomes, pages, coverage, connections, history, and configuration.
Desktop can display more information at once.
It should not introduce a different mental model.
## 23. Healthy FixFlags is intentionally boring
A good monitoring product should not create work simply to justify its existence.
A normal day might look like:
🟢 Everything important we're watching is healthy
Buy verified 16m ago
Signup verified 28m ago
Website live

That's enough.
The customer should not need to inspect FixFlags every morning.
FixFlags watches the website so the customer doesn't have to.
## 24. Alerts are rarer than Flags
Finding something and interrupting somebody are different decisions.
FixFlags should alert only when the situation deserves interruption.
That decision can consider:
- severity
- certainty
- affected Outcome
- exposure
- commercial importance
- duration
- recurrence
- recent change
A low-priority search recommendation can wait inside FixFlags.
Checkout failing should not.
Trustworthy alerts are part of the product.
If FixFlags sends too many meaningless notifications, the entire promise collapses.
## 25. Free creates the relationship. Paid deepens responsibility.
The free product should not be a crippled demo.
Free analysis
URL → useful understanding of the website.
This is acquisition.
Free Site
Save a Site and receive enough ongoing monitoring to experience FixFlags doing its job.
Free observation
If connecting FixFlags provides better evidence at sustainable cost, installation should increase usefulness rather than immediately create punishment.
Paid plans should primarily purchase greater responsibility:
- more frequent checks
- greater page coverage
- more Outcomes
- deeper verification
- longer history
- real-user monitoring at scale
- premium connections
- faster alerts
- more Sites
- team and client workflows
- agent automation
- protective actions where appropriate
The free product answers:
How is my website?

Paid answers:
Keep taking care of it for me.

## 26. Distribution is part of the product
FixFlags should naturally spread through several loops.
Check any URL
The lowest possible adoption barrier.
Share a Flag
A developer, client, founder, or agency receives useful evidence without needing to understand FixFlags first.
Share verification
A team can prove that an important behavior was checked and is working.
Platform distribution
Shopify is an especially strong early channel because installation is easy and the business Outcome is obvious.
Agents
A coding agent can recommend FixFlags, install it, read Flags, work on fixes, and request verification.
Search and content
People continually ask versions of:
Is my website working?

Why did my checkout stop converting?

Is my website healthy?

Is Google able to understand my site?

FixFlags has a natural answer.
## 27. Shopify is a wedge, not the company
Shopify is strategically attractive because:
- Purchase is obvious
- commerce data adds strong context
- installation can be native
- failures have direct economic value
- merchants already understand apps
- the App Store provides distribution
So we can market:
FixFlags for Shopify

But once installed, the merchant enters the same FixFlags.
The same Site.
The same Flags.
The same Outcomes.
The same system.
Shopify makes FixFlags smarter.
It does not redefine FixFlags.
## 28. Privacy makes the product better
FixFlags should collect only what it needs to recognize website problems.
Avoid building surveillance simply because the technology makes it possible.
Do not default to:
- session recording
- keystroke capture
- invasive identity tracking
- unnecessary personal data
- enormous raw event warehouses
Prefer:
- synthetic verification
- aggregate real-user signals
- purpose-specific telemetry
- minimal retention
- clear boundaries
The observer exists to protect the Site, not to profile its visitors.
This constraint keeps the product simpler as well as safer.
## 29. What FixFlags deliberately does not become
FixFlags can borrow capabilities from many categories without becoming those categories.
Do not turn it into:
- a generic analytics platform
- a full SEO suite
- an Ads Manager
- a CDP
- a generic observability product
- a session replay business
- an experimentation platform
- a project-management system
- an arbitrary dashboard builder
- a giant integration marketplace
- an event warehouse
- an AI chatbot with a crawler attached
Whenever a new feature appears, ask:
Does this make FixFlags better at knowing when the Site needs attention, understanding why, helping resolve it, or verifying recovery?

If not, it probably does not belong.
## 30. The product standard
Every product decision should survive these questions:
Can FixFlags figure this out instead of asking the customer?

What important thing does this help us watch?

What better decision can FixFlags make because it knows this?

Does this integration improve an answer we already give?

Is this actually a Flag, or merely something we happened to detect?

What evidence supports this conclusion?

What should the customer do differently after seeing it?

Can we verify that the problem is gone?

Can the interface remain simple even if the intelligence underneath becomes ten times deeper?

These are not design preferences.
They are product constraints.
## 31. The north-star experience
A founder discovers FixFlags.
They enter:
acme.com
FixFlags starts learning.
Website live ✓
Shopify detected ✓
42 pages discovered
Purchase detected
Contact detected
Checking mobile…
Testing Purchase…

Then:
We think these are the important things people need to be able to do
Buy
Contact
Looks right

The dashboard appears.
🔴 1 thing needs attention
Customers cannot add one product variant to cart on mobile.
Confirmed twice.

They open the Flag.
They understand the problem immediately.
They watch the evidence.
They tap:
Fix this

They send it to their coding agent.
The agent fixes the problem and deploys.
FixFlags reruns the exact behavior.
✓ Resolved
Fix verified.

The founder taps:
Keep watching

Later:
Shopify detected
Connect Shopify so FixFlags can confirm real products and purchase outcomes.

They connect it.
Then Meta.
Then deployment context.
FixFlags becomes more informed without becoming more complicated.
Weeks pass.
The founder mostly forgets FixFlags exists.
Then one afternoon:
🔴 Purchase is failing on mobile
FixFlags reproduced it twice.
The problem began after today's release.
Four active campaigns currently send traffic through this path.
View Flag

They know they need to act.
That moment is why FixFlags exists.
## 32. The company
We are not trying to build the website product with the most features.
We are trying to create the place a business connects its website once and trusts for years.
At first, FixFlags knows a URL.
Then it learns the Site.
Then its important Outcomes.
Then what normal looks like.
Then its traffic.
Its products.
Its search presence.
Its marketing dependencies.
Its releases.
Its history.
Its recurring problems.
Its fixes.
And the evidence that proves those fixes worked.
Over time, FixFlags should understand the operational health of that website better than almost anyone working on it.
That accumulated understanding is the long-term asset.
The interface should barely grow.
The intelligence underneath it can become enormous.
## The vision
FixFlags exists so important website problems don't sit unnoticed.
Connect a website once.
FixFlags learns what it is, what people need to be able to do, and what the business depends on.
It checks the website continuously, independently verifies important behavior, learns from real usage when available, and connects to the systems that provide additional context.
It may understand availability, performance, accessibility, search, measurement, pages, customer journeys, commerce, traffic, marketing and changes. But it never asks the customer to assemble those worlds themselves.
FixFlags turns all of that complexity into a simple answer:
Does anything need my attention?
When the answer is no, FixFlags stays quiet.
When the answer is yes, it raises a Flag that explains what happened, why it matters, what proves it, and what should happen next.
The same Flag can be understood by a business owner, investigated by a developer, or acted on by an agent.
And a problem is not finished simply because somebody changed the code.
FixFlags checks again.
The product begins with a URL and becomes more valuable every day it remains connected.
Simple on the surface.
Deep underneath.
Honest about what it knows.
Quiet when things are healthy.
Unmissable when something matters.
Your website, looked after.
