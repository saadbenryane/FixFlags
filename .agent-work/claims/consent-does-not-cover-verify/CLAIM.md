# consent-does-not-cover-verify

objective: Keep the first-visit analytics choice from covering Verify
outcome: The consent dialog sits at the top and the page content starts below it, so Verify and the mobile navigation stay reachable
surfaces: components/analytics/ConversionScripts.tsx and its test
dependencies: does not edit lib/marketing/copy or Shopify files claimed by stranger-shopify-ready
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-23T22:09:25Z
completed: 2026-09-23T23:12:00Z
verification: ConversionScripts test (dialog uses top-3, html padding-top 12rem while open, cleared after Only necessary). Phone screenshots of Flag, Home, and Settings show the choice at the top. Logo, Verify fix, Outcome Verify, Watch, and Connect Shopify sit below it and stay tappable. Horizontal overflow 0.
remaining: The Site Agent button still covers the Home Flag row and the Settings notification control on a phone. Public arrival from / has not been walked. Next.js dev issue badge is not product UI.
next: public-arrival
