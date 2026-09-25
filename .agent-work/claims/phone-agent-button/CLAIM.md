# phone-agent-button

objective: Keep the Site Agent control off phone Flag rows and Settings actions
outcome: On a phone the Agent control sits in the Site header. On a wide screen it stays a corner button. Flag rows and Settings actions are unobstructed.
surfaces: components/sites/SiteAgentPanel.tsx, components/sites/SiteBoard.tsx, a render test
dependencies: does not edit marketing copy, Shopify, or connection settings owned by other claims
status: complete
agent: grok-goal-18c5ed77dbc7
timestamp: 2026-09-23T23:22:00Z
completed: 2026-09-23T23:35:00Z
verification: SiteAgentPanel test passed. On a 375px signed-in Home and Settings page the Agent control sits in the header beside Watch (y=148 once the analytics choice is saved). The Flag row chevron and Save notifications are clear of it. On a 1280px Home the same control docks to the corner (x=1152, y=832). Opening it shows the FixFlags Agent dialog.
remaining: A stranger's first Analyze reaches a learning board, and that check does not finish unless the worker is running. Next.js dev issue badge is not product UI.
next: first-check-progress
