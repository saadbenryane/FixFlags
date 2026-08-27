# Feedback create-on-first-message

**Status:** complete  
**Board:** `feedback-create-on-message`  
**Goal:** Persist SupportSession only when a visitor sends a message; admin Conversations list real chats only.

## Checklist

- [x] Server: atomic firstMessage create; no empty create; list/count filter; orphan close
- [x] Client: FAB open UI-only; panel send via firstMessage; unified welcome
- [x] AdminInbox empty copy + lastMessageAt affordance
- [x] Tests + light docs + verify

## Notes

Root cause: FAB `openPanel` POSTed `/api/support/sessions` creating OPEN + SYSTEM with `lastMessageAt` null.

Shipped: create requires `firstMessage`; open filter / dashboard count use `lastMessageAt not null`; admin feedback page closes orphans; FAB no longer creates on open.

Proof: `npx vitest run lib/live-support/__tests__/sessions.test.ts components/live-support/__tests__/SupportChatPanel.test.tsx` green.
